const Result = require("../models/Result");

const getModerationQueue = async () => {
  const allResults = await Result.find({})
    .sort({ createdAt: -1 })
    .select("studentName userId category driveFileId originalFileName createdAt status percentage")
    .lean();

  const driveIds = new Map();
  const fileNames = new Map();
  const flags = [];

  allResults.forEach((result) => {
    if (result.driveFileId) {
      const existing = driveIds.get(result.driveFileId);
      if (existing) {
        flags.push({
          id: `${existing._id}-${result._id}-drive`,
          reason: "Same File Uploaded Multiple Times",
          resultIds: [existing._id, result._id],
          status: "open",
          severity: "high",
          studentName: result.studentName,
          createdAt: result.createdAt,
        });
      } else {
        driveIds.set(result.driveFileId, result);
      }
    }

    const fileNameKey = (result.originalFileName || "").toLowerCase().trim();
    if (fileNameKey) {
      const existing = fileNames.get(fileNameKey);
      if (existing && existing.userId?.toString() === result.userId?.toString()) {
        flags.push({
          id: `${existing._id}-${result._id}-name`,
          reason: "Duplicate Result Upload",
          resultIds: [existing._id, result._id],
          status: "open",
          severity: "medium",
          studentName: result.studentName,
          createdAt: result.createdAt,
        });
      } else {
        fileNames.set(fileNameKey, result);
      }
    }
  });

  return flags.slice(0, 100);
};

module.exports = {
  getModerationQueue,
};
