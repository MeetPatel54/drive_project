export const formatResultScore = (result) => {
  if (typeof result.percentage === "number") return `${result.percentage}%`;
  if (result.educationDetails?.obtainedCGPA && result.educationDetails?.totalCGPA) {
    return `${result.educationDetails.obtainedCGPA}/${result.educationDetails.totalCGPA} CGPA`;
  }
  if (result.educationDetails?.obtainedMarks && result.educationDetails?.totalMarks) {
    return `${result.educationDetails.obtainedMarks}/${result.educationDetails.totalMarks}`;
  }
  return "—";
};

export const getScoreColor = (percentage, fallback = "text-gray-700") => {
  if (typeof percentage !== "number") return fallback;
  if (percentage >= 75) return "text-emerald-600";
  if (percentage >= 50) return "text-amber-600";
  return "text-red-600";
};

export const formatResultLevel = (result) =>
  [result.course || result.subCategory || result.grade, result.stream]
    .filter(Boolean)
    .join(" / ") || "-";

export const formatResultDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

export const resultToExportRow = (result) => ({
  studentName: result.studentName || "-",
  email: result.userId?.email || "-",
  village: result.village || result.userId?.nativeVillage || result.userId?.village || "-",
  category: result.category || result.subject || "-",
  level: formatResultLevel(result),
  score: formatResultScore(result),
  status: result.status || "-",
  submitted: formatResultDate(result.createdAt),
  reviewedBy: result.reviewedBy?.name || "-",
  rejectionReason: result.rejectionReason || "-",
});

export const resultExportColumns = [
  { key: "studentName", label: "Student" },
  { key: "email", label: "Email" },
  { key: "village", label: "Village" },
  { key: "category", label: "Category" },
  { key: "level", label: "Level" },
  { key: "score", label: "Score" },
  { key: "status", label: "Status" },
  { key: "submitted", label: "Submitted" },
  { key: "reviewedBy", label: "Reviewed By" },
  { key: "rejectionReason", label: "Rejection Reason" },
];
