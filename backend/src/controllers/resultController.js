const Result = require("../models/Result");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { uploadToDrive, deleteFromDrive, streamFromDrive } = require("../utils/driveHelper");

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const roundScore = (value) => (value === null ? null : Math.round(value * 100) / 100);

const calculatePercentage = (obtained, total) => {
  const obtainedValue = toNumber(obtained);
  const totalValue = toNumber(total);
  if (obtainedValue === null || totalValue === null || totalValue <= 0) return null;
  return roundScore((obtainedValue / totalValue) * 100);
};

const percentage = (part, total) => (total > 0 ? roundScore((part / total) * 100) : 0);

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");

const cleanEducationDetails = (details, keys) =>
  keys.reduce((acc, key) => {
    const value = details[key];
    if (value !== undefined && value !== null && value !== "") {
      acc[key] = ["totalMarks", "obtainedMarks", "percentileRank", "totalCGPA", "obtainedCGPA", "rank"].includes(key)
        ? toNumber(value)
        : cleanString(value);
    }
    return acc;
  }, {});

const buildResultPayload = ({ body, user, driveData, originalFileName }) => {
  const details = body.educationDetails || {};
  const nativeVillage = user.nativeVillage || user.village;
  const category = body.category;
  const subCategory = cleanString(body.subCategory);
  const stream = cleanString(body.stream);
  const course = cleanString(body.course);
  const description = cleanString(body.description);

  let educationDetails = {};
  let percentage = null;
  let grade = "";
  let subject = category;

  if (category === "1st-10th") {
    educationDetails = cleanEducationDetails(details, [
      "percentileRank",
      "totalMarks",
      "obtainedMarks",
      "schoolName",
    ]);
    percentage = calculatePercentage(details.obtainedMarks, details.totalMarks);
    grade = `${subCategory}th Standard`;
    subject = "School";
  }

  if (category === "11th-12th & Diploma") {
    if (subCategory === "11th" || subCategory === "12th") {
      educationDetails = cleanEducationDetails(details, [
        "percentileRank",
        "totalMarks",
        "obtainedMarks",
        "schoolName",
      ]);
      percentage = calculatePercentage(details.obtainedMarks, details.totalMarks);
      grade = subCategory;
      subject = stream;
    }

    if (subCategory === "Diploma") {
      educationDetails = cleanEducationDetails(details, ["collegeName", "totalCGPA", "obtainedCGPA"]);
      percentage = calculatePercentage(details.obtainedCGPA, details.totalCGPA);
      grade = "Diploma";
      subject = course;
    }
  }

  if (category === "Undergraduate" || category === "Postgraduate") {
    educationDetails = cleanEducationDetails(details, ["collegeName", "totalCGPA", "obtainedCGPA"]);
    percentage = calculatePercentage(details.obtainedCGPA, details.totalCGPA);
    grade = category;
    subject = course;
  }

  if (category === "Government Exams") {
    educationDetails = cleanEducationDetails(details, [
      "qualifiedExamName",
      "rank",
      "totalMarks",
      "obtainedMarks",
      "designationObtained",
    ]);
    percentage = calculatePercentage(details.obtainedMarks, details.totalMarks);
    grade = "Government Exam";
    subject = educationDetails.qualifiedExamName || "Government Exam";
  }

  return {
    studentName: body.studentName,
    village: nativeVillage,
    percentage,
    category,
    subCategory,
    stream,
    course,
    educationDetails,
    description,
    grade,
    subject,
    examYear: cleanString(body.examYear),
    status: "pending",
    driveFileId: driveData.fileId,
    driveLink: driveData.driveLink,
    driveFolderName: driveData.folderName,
    userId: user._id,
    originalFileName,
  };
};

const getAnalyticsCategory = (result) => {
  if (result.category === "11th-12th & Diploma") {
    if (result.subCategory === "Diploma") return "Diploma";
    return "11th-12th";
  }
  if (result.category === "Government Exams") return "Government Exams";
  return result.category || result.subject || "Other";
};

const getInstitutionName = (result) => {
  const details = result.educationDetails || {};
  return cleanString(details.schoolName || details.collegeName);
};

const getResultScore = (result) => toNumber(result.percentage);

const averageScore = (results) => {
  const scores = results.map(getResultScore).filter((score) => score !== null);
  if (!scores.length) return 0;
  return roundScore(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

const createResultFilter = ({ village, status, category, institution, dateFrom, dateTo }) => {
  const filter = {};

  if (village) filter.village = village;
  if (status) filter.status = status;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (category === "11th-12th") {
    filter.category = "11th-12th & Diploma";
    filter.subCategory = { $in: ["11th", "12th"] };
  } else if (category === "Diploma") {
    filter.category = "11th-12th & Diploma";
    filter.subCategory = "Diploma";
  } else if (category) {
    filter.category = category;
  }

  if (institution) {
    const regex = { $regex: institution, $options: "i" };
    filter.$or = [
      { "educationDetails.schoolName": regex },
      { "educationDetails.collegeName": regex },
    ];
  }

  return filter;
};

const applyScoreFilter = (filter, { minPercentage, maxPercentage }) => {
  if (minPercentage || maxPercentage) {
    filter.percentage = {};
    if (minPercentage) filter.percentage.$gte = parseFloat(minPercentage);
    if (maxPercentage) filter.percentage.$lte = parseFloat(maxPercentage);
  }
  return filter;
};

const groupBy = (items, getKey) =>
  items.reduce((acc, item) => {
    const key = getKey(item);
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

const countBy = (items, getKey) =>
  Object.entries(groupBy(items, getKey))
    .map(([label, values]) => ({ label, count: values.length }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

const performanceBy = (items, getKey) =>
  Object.entries(groupBy(items, getKey))
    .map(([label, values]) => ({
      label,
      avgScore: averageScore(values),
      count: values.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore || b.count - a.count);

const buildAchievementText = (result) => {
  const score = result.percentage !== null && result.percentage !== undefined ? `${result.percentage}%` : "";
  const details = result.educationDetails || {};

  if (result.category === "Government Exams") {
    const exam = details.qualifiedExamName || result.subject || "Government Exam";
    const designation = details.designationObtained ? ` as ${details.designationObtained}` : "";
    return `${result.studentName} qualified ${exam}${designation}`;
  }

  if (result.category === "11th-12th & Diploma" && ["11th", "12th"].includes(result.subCategory)) {
    return `${result.studentName} scored ${score || "well"} in ${result.subCategory} ${result.stream || ""}`.trim();
  }

  if (["Undergraduate", "Postgraduate"].includes(result.category) || result.subCategory === "Diploma") {
    const cgpa = details.obtainedCGPA ? `${details.obtainedCGPA} CGPA` : score;
    return `${result.studentName} completed ${result.course || result.category} with ${cgpa || "a strong result"}`;
  }

  return `${result.studentName} scored ${score || "a strong result"} in ${getAnalyticsCategory(result)}`;
};

const isOutstandingResult = (result) => {
  if (result.category === "Government Exams") return true;
  const score = getResultScore(result);
  return score !== null && score >= 90;
};

const createOutstandingNotification = async (result) => {
  if (!isOutstandingResult(result)) return;

  const exists = await Notification.exists({ resultId: result._id, type: "auto" });
  if (exists) return;

  await Notification.create({
    title: "Outstanding Performance",
    message: buildAchievementText(result),
    type: "auto",
    priority: "normal",
    audience: "all_students",
    resultId: result._id,
    metadata: {
      studentName: result.studentName,
      village: result.village,
      category: getAnalyticsCategory(result),
      score: result.percentage,
    },
  });
};

const toStudentScore = (result) => ({
  id: result._id,
  studentName: result.studentName,
  village: result.village || result.userId?.nativeVillage || result.userId?.village || "",
  category: result.category,
  subCategory: result.subCategory,
  stream: result.stream,
  course: result.course,
  percentage: result.percentage,
  educationDetails: result.educationDetails || {},
  result,
});

// ─── POST /api/results/upload ─── Student uploads result ───────────────────
const uploadResult = async (req, res) => {
  const tempPath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded." });
    }

    const nativeVillage = req.user.nativeVillage || req.user.village;
    if (!nativeVillage) {
      if (tempPath && require("fs").existsSync(tempPath)) {
        require("fs").unlinkSync(tempPath);
      }
      return res.status(400).json({
        success: false,
        error: "Please select your native village in your student profile before uploading results.",
      });
    }

    const { studentName, category, examYear } = req.body;
    const fileSuffix = examYear || category || "result";

    // Upload to Google Drive (private, no public permission)
    const driveData = await uploadToDrive({
      filePath: tempPath,
      fileName: `${studentName}_${fileSuffix}_${Date.now()}${
        require("path").extname(req.file.originalname)
      }`,
      mimeType: req.file.mimetype,
      description: `Result for ${studentName} - ${category}`,
    });

    // Save metadata to MongoDB
    const result = await Result.create(buildResultPayload({
      body: req.body,
      user: req.user,
      driveData,
      originalFileName: req.file.originalname,
    }));

    if (!req.user.nativeVillage && req.user.village) {
      req.user.nativeVillage = req.user.village;
      await req.user.save({ validateBeforeSave: false });
    } else if (req.user.nativeVillage && req.user.village !== req.user.nativeVillage) {
      req.user.village = req.user.nativeVillage;
      await req.user.save({ validateBeforeSave: false });
    }

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
    const { page = 1, limit = 20 } = req.query;
    const filter = applyScoreFilter(createResultFilter(req.query), req.query);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Result.countDocuments(filter);

    const results = await Result.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "name email village nativeVillage")
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
    await result.populate("userId", "name email village nativeVillage");

    if (status === "approved") {
      await createOutstandingNotification(result);
    }

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
      .populate("userId", "name email village nativeVillage");

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

// ─── GET /api/results/analytics ─── Teacher analytics dashboard ────────────
const getAnalytics = async (req, res) => {
  try {
    const filter = createResultFilter(req.query);
    const [results, allResults, totalStudents] = await Promise.all([
      Result.find(filter)
        .sort({ createdAt: -1 })
        .populate("userId", "name email village nativeVillage")
        .lean(),
      Result.find({})
        .select("village category subCategory educationDetails status")
        .lean(),
      User.countDocuments({ role: "student" }),
    ]);

    const approvedResults = results.filter((result) => result.status === "approved");
    const scoreSource = approvedResults.length ? approvedResults : results;
    const totalResults = results.length;
    const statusCounts = {
      approved: results.filter((result) => result.status === "approved").length,
      pending: results.filter((result) => result.status === "pending").length,
      rejected: results.filter((result) => result.status === "rejected").length,
    };

    const governmentResults = results.filter((result) => result.category === "Government Exams");
    const scoredResults = [...scoreSource]
      .filter((result) => getResultScore(result) !== null)
      .sort((a, b) => getResultScore(b) - getResultScore(a))
    const topStudents = scoredResults.slice(0, 10).map(toStudentScore);
    const categoryScoreboards = Object.entries(groupBy(scoredResults, getAnalyticsCategory))
      .map(([label, values]) => ({
        label,
        avgScore: averageScore(values),
        students: values
          .sort((a, b) => getResultScore(b) - getResultScore(a))
          .slice(0, 5)
          .map(toStudentScore),
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    const categoryDistribution = countBy(results, getAnalyticsCategory).map((item) => ({
      ...item,
      percentage: percentage(item.count, totalResults),
    }));

    const approvalAnalytics = Object.entries(statusCounts).map(([label, count]) => ({
      label,
      count,
      percentage: percentage(count, totalResults),
    }));

    const villages = [...new Set(allResults.map((result) => result.village).filter(Boolean))].sort();
    const institutions = [
      ...new Set(allResults.map(getInstitutionName).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalResultSubmissions: totalResults,
          approvedResults: statusCounts.approved,
          pendingResults: statusCounts.pending,
          rejectedResults: statusCounts.rejected,
          totalVillagesCovered: new Set(results.map((result) => result.village).filter(Boolean)).size,
          averagePerformance: averageScore(scoreSource),
          governmentExamQualifiedStudents: new Set(
            governmentResults
              .filter((result) => result.status === "approved")
              .map((result) => result.userId?._id?.toString() || result.userId?.toString())
              .filter(Boolean)
          ).size,
        },
        villagePerformance: performanceBy(scoreSource, (result) => result.village).slice(0, 10),
        categoryDistribution,
        educationPerformance: performanceBy(scoreSource, getAnalyticsCategory),
        topStudents,
        categoryScoreboards,
        governmentExamAchievements: countBy(governmentResults, (result) => result.educationDetails?.qualifiedExamName || result.subject).slice(0, 12),
        collegeAnalytics: countBy(
          results.filter((result) => ["Undergraduate", "Postgraduate"].includes(result.category)),
          (result) => result.educationDetails?.collegeName
        ).slice(0, 10),
        schoolAnalytics: countBy(
          results.filter((result) => result.category === "1st-10th" || ["11th", "12th"].includes(result.subCategory)),
          (result) => result.educationDetails?.schoolName
        ).slice(0, 10),
        approvalAnalytics,
        recentAchievements: approvedResults.slice(0, 10).map((result) => ({
          id: result._id,
          text: buildAchievementText(result),
          village: result.village,
          createdAt: result.createdAt,
          result,
        })),
        filters: {
          villages,
          institutions,
          categories: ["1st-10th", "11th-12th", "Diploma", "Undergraduate", "Postgraduate", "Government Exams"],
          statuses: ["approved", "pending", "rejected"],
        },
      },
    });
  } catch (err) {
    console.error("getAnalytics error:", err.message);
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
  getAnalytics,
  deleteResult,
  streamResult,
};
