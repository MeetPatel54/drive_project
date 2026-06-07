const Result = require("../models/Result");

const aggregateAdminAnalytics = async () => {
  const results = await Result.find({})
    .select("village category subCategory percentage educationDetails reviewedBy reviewLock reviewedAt createdAt status")
    .populate("reviewedBy", "name email")
    .lean();

  const villages = new Map();
  const teachers = new Map();
  const institutions = new Map();
  const categories = new Map();

  results.forEach((result) => {
    if (result.village) {
      const item = villages.get(result.village) || { label: result.village, studentCount: 0, totalScore: 0, scoredCount: 0 };
      item.studentCount += 1;
      if (typeof result.percentage === "number") {
        item.totalScore += result.percentage;
        item.scoredCount += 1;
      }
      villages.set(result.village, item);
    }

    const categoryLabel = result.subCategory === "Diploma" ? "Diploma" : result.category || "Other";
    const categoryItem = categories.get(categoryLabel) || { label: categoryLabel, count: 0, totalScore: 0, scoredCount: 0 };
    categoryItem.count += 1;
    if (typeof result.percentage === "number") {
      categoryItem.totalScore += result.percentage;
      categoryItem.scoredCount += 1;
    }
    categories.set(categoryLabel, categoryItem);

    const institution = result.educationDetails?.schoolName || result.educationDetails?.collegeName;
    if (institution) {
      const type = result.educationDetails?.schoolName ? "school" : "college";
      const institutionItem = institutions.get(institution) || { label: institution, type, count: 0, totalScore: 0, scoredCount: 0 };
      institutionItem.count += 1;
      if (typeof result.percentage === "number") {
        institutionItem.totalScore += result.percentage;
        institutionItem.scoredCount += 1;
      }
      institutions.set(institution, institutionItem);
    }

    if (result.reviewedBy?.name) {
      const teacherItem = teachers.get(result.reviewedBy.name) || { label: result.reviewedBy.name, reviewed: 0, approved: 0, rejected: 0, avgReviewTimeMinutes: 0 };
      teacherItem.reviewed += 1;
      if (result.status === "approved") teacherItem.approved += 1;
      if (result.status === "rejected") teacherItem.rejected += 1;
      if (result.reviewLock?.lockedAt && result.reviewedAt) {
        teacherItem.avgReviewTimeMinutes += Math.max((new Date(result.reviewedAt) - new Date(result.reviewLock.lockedAt)) / 60000, 0);
      }
      teachers.set(result.reviewedBy.name, teacherItem);
    }
  });

  return {
    villageAnalytics: [...villages.values()].map((item) => ({
      label: item.label,
      studentCount: item.studentCount,
      avgPerformance: item.scoredCount ? Number((item.totalScore / item.scoredCount).toFixed(1)) : 0,
    })).sort((a, b) => b.avgPerformance - a.avgPerformance),
    teacherAnalytics: [...teachers.values()].map((item) => ({
      label: item.label,
      reviewCount: item.reviewed,
      approvalRate: item.reviewed ? Number(((item.approved / item.reviewed) * 100).toFixed(1)) : 0,
      avgReviewTimeMinutes: item.reviewed ? Number((item.avgReviewTimeMinutes / item.reviewed).toFixed(1)) : 0,
    })).sort((a, b) => b.reviewCount - a.reviewCount),
    institutionAnalytics: [...institutions.values()].map((item) => ({
      label: item.label,
      type: item.type,
      count: item.count,
      avgPerformance: item.scoredCount ? Number((item.totalScore / item.scoredCount).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count),
    categoryAnalytics: [...categories.values()].map((item) => ({
      label: item.label,
      count: item.count,
      avgPerformance: item.scoredCount ? Number((item.totalScore / item.scoredCount).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count),
  };
};

module.exports = {
  aggregateAdminAnalytics,
};
