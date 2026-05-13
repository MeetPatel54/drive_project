const Result = require("../models/Result");
const { uploadToDrive, deleteFromDrive, streamFromDrive } = require("../utils/driveHelper");

// ─── POST /api/results/upload ─── Student uploads result ───────────────────
const uploadResult = async (req, res) => {
  const tempPath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded." });
    }

    const { studentName, village, percentage, grade, subject, examYear } = req.body;

    // Upload to Google Drive (private, no public permission)
    const driveData = await uploadToDrive({
      filePath: tempPath,
      fileName: `${studentName}_${examYear || "result"}_${Date.now()}${
        require("path").extname(req.file.originalname)
      }`,
      mimeType: req.file.mimetype,
      description: `Result for ${studentName} — ${percentage}%`,
    });

    // Save metadata to MongoDB
    const result = await Result.create({
      studentName,
      village: village || req.user.village || "",
      percentage: parseFloat(percentage),
      grade: grade || "",
      subject: subject || "",
      examYear: examYear || "",
      status: "pending",
      driveFileId: driveData.fileId,
      driveLink: driveData.driveLink,
      driveFolderName: driveData.folderName,
      userId: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Result uploaded successfully. Awaiting teacher approval.",
      data: result,
    });
  } catch (err) {
    // Cleanup temp file on error
    if (tempPath && require("fs").existsSync(tempPath)) {
      require("fs").unlinkSync(tempPath);
    }
    console.error("uploadResult error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/results/my ─── Student views own results ─────────────────────
const getMyResults = async (req, res) => {
  try {
    const results = await Result.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("reviewedBy", "name email");

    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    console.error("getMyResults error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/results/all ─── Teacher views all results ────────────────────
const getAllResults = async (req, res) => {
  try {
    const { status, minPercentage, maxPercentage, village, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (village) filter.village = { $regex: village, $options: "i" };
    if (minPercentage || maxPercentage) {
      filter.percentage = {};
      if (minPercentage) filter.percentage.$gte = parseFloat(minPercentage);
      if (maxPercentage) filter.percentage.$lte = parseFloat(maxPercentage);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Result.countDocuments(filter);

    const results = await Result.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "name email village")
      .populate("reviewedBy", "name email");

    res.json({
      success: true,
      count: results.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: results,
    });
  } catch (err) {
    console.error("getAllResults error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── PATCH /api/results/:id/status ─── Teacher approves or rejects ─────────
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const result = await Result.findById(id);
    if (!result) {
      return res.status(404).json({ success: false, error: "Result not found." });
    }

    result.status = status;
    result.reviewedBy = req.user._id;
    result.reviewedAt = new Date();
    if (status === "rejected" && rejectionReason) {
      result.rejectionReason = rejectionReason;
    } else {
      result.rejectionReason = "";
    }

    await result.save();

    await result.populate("reviewedBy", "name email");
    await result.populate("userId", "name email");

    res.json({
      success: true,
      message: `Result ${status} successfully.`,
      data: result,
    });
  } catch (err) {
    console.error("updateStatus error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/results/top ─── Top 3 students by percentage ─────────────────
const getTopStudents = async (req, res) => {
  try {
    const top = await Result.find({ status: "approved" })
      .sort({ percentage: -1 })
      .limit(3)
      .populate("userId", "name email village");

    res.json({ success: true, data: top });
  } catch (err) {
    console.error("getTopStudents error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/results/stats ─── Dashboard statistics ───────────────────────
const getStats = async (req, res) => {
  try {
    const [total, pending, approved, rejected, avgResult] = await Promise.all([
      Result.countDocuments(),
      Result.countDocuments({ status: "pending" }),
      Result.countDocuments({ status: "approved" }),
      Result.countDocuments({ status: "rejected" }),
      Result.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, avgPercentage: { $avg: "$percentage" } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        avgPercentage: avgResult[0]?.avgPercentage?.toFixed(1) || 0,
      },
    });
  } catch (err) {
    console.error("getStats error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── DELETE /api/results/:id ─── Student deletes own pending result ─────────
const deleteResult = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await Result.findById(id);
    if (!result) {
      return res.status(404).json({ success: false, error: "Result not found." });
    }

    // Students can only delete their own pending results
    if (
      req.user.role === "student" &&
      (result.userId.toString() !== req.user._id.toString() || result.status !== "pending")
    ) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own pending results.",
      });
    }

    // Delete from Drive
    await deleteFromDrive(result.driveFileId);

    // Delete from MongoDB
    await result.deleteOne();

    res.json({ success: true, message: "Result deleted successfully." });
  } catch (err) {
    console.error("deleteResult error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/results/:id/stream ─── Stream result file from Drive ──────────
const streamResult = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await Result.findById(id);
    if (!result) {
      return res.status(404).json({ success: false, error: "Result not found." });
    }

    // Students can only stream their own results
    if (
      req.user.role === "student" &&
      result.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    await streamFromDrive(result.driveFileId, res);
  } catch (err) {
    console.error("streamResult error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  uploadResult,
  getMyResults,
  getAllResults,
  updateStatus,
  getTopStudents,
  getStats,
  deleteResult,
  streamResult,
};
