const fs = require("fs");
const { z } = require("zod");

const RESULT_CATEGORIES = [
  "1st-10th",
  "11th-12th & Diploma",
  "Undergraduate",
  "Postgraduate",
  "Government Exams",
];
const STANDARDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const HIGHER_SECONDARY_TYPES = ["11th", "12th", "Diploma"];
const STREAMS = ["Science", "Commerce", "Arts"];
const DIPLOMA_COURSES = [
  "Diploma Computer Engineering",
  "Diploma Information Technology",
  "Diploma Mechanical Engineering",
  "Diploma Civil Engineering",
  "Diploma Electrical Engineering",
  "Diploma Electronics & Communication",
  "Diploma Automobile Engineering",
  "Diploma Chemical Engineering",
  "Diploma Instrumentation & Control",
  "Diploma Pharmacy",
  "Diploma Architecture Assistantship",
  "Diploma Textile Engineering",
  "Diploma Mining Engineering",
  "Diploma Metallurgy",
  "Other",
];
const UNDERGRADUATE_COURSES = [
  "B.E.",
  "B.Tech",
  "MBBS",
  "BDS",
  "BAMS",
  "BHMS",
  "B.Sc Nursing",
  "BCA",
  "BBA",
  "B.Com",
  "B.Sc",
  "B.A.",
  "B.Pharm",
  "B.Arch",
  "BSW",
  "Other",
];
const POSTGRADUATE_COURSES = [
  "M.E.",
  "M.Tech",
  "MBA",
  "MCA",
  "M.Com",
  "M.Sc",
  "M.A.",
  "M.Pharm",
  "MS",
  "MD",
  "MDS",
  "Other",
];
const GOVERNMENT_EXAMS = [
  "GPSC",
  "GSSSB",
  "GPSSB",
  "TET",
  "HTAT",
  "GSET",
  "PSI",
  "Constable",
  "Talati",
  "Gram Sevak",
  "Junior Clerk",
  "Senior Clerk",
  "Other",
];

const optionalText = (max = 1000) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

const educationDetailsSchema = z.preprocess((value) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}, z.record(z.any()));

const addIssue = (ctx, field, message) => {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: field.split("."),
    message,
  });
};

const getText = (details, key) =>
  typeof details[key] === "string" ? details[key].trim() : details[key]?.toString().trim();

const requireText = (ctx, details, key, label, allowedValues = null) => {
  const value = getText(details, key);
  if (!value) {
    addIssue(ctx, `educationDetails.${key}`, `${label} is required`);
    return;
  }
  if (allowedValues && !allowedValues.includes(value)) {
    addIssue(ctx, `educationDetails.${key}`, `${label} is invalid`);
  }
};

const requireTopLevelText = (ctx, data, key, label, allowedValues = null) => {
  const value = typeof data[key] === "string" ? data[key].trim() : "";
  if (!value) {
    addIssue(ctx, key, `${label} is required`);
    return;
  }
  if (allowedValues && !allowedValues.includes(value)) {
    addIssue(ctx, key, `${label} is invalid`);
  }
};

const readNumber = (details, key) => {
  const value = details[key];
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const requireNumber = (ctx, details, key, label, { min = 0, max = Infinity } = {}) => {
  const value = readNumber(details, key);
  if (value === null || Number.isNaN(value)) {
    addIssue(ctx, `educationDetails.${key}`, `${label} must be a valid number`);
    return null;
  }
  if (value < min || value > max) {
    addIssue(ctx, `educationDetails.${key}`, `${label} must be between ${min} and ${max}`);
  }
  return value;
};

const optionalNumber = (ctx, details, key, label, { min = 0, max = Infinity } = {}) => {
  const value = readNumber(details, key);
  if (value === null) return null;
  if (Number.isNaN(value)) {
    addIssue(ctx, `educationDetails.${key}`, `${label} must be a valid number`);
    return null;
  }
  if (value < min || value > max) {
    addIssue(ctx, `educationDetails.${key}`, `${label} must be between ${min} and ${max}`);
  }
  return value;
};

const requireMarks = (ctx, details, required = true) => {
  const read = required ? requireNumber : optionalNumber;
  const totalMarks = read(ctx, details, "totalMarks", "Total marks");
  const obtainedMarks = read(ctx, details, "obtainedMarks", "Obtained marks");

  if (totalMarks !== null && obtainedMarks !== null && obtainedMarks > totalMarks) {
    addIssue(ctx, "educationDetails.obtainedMarks", "Obtained marks cannot exceed total marks");
  }
};

const requireCgpa = (ctx, details) => {
  const totalCGPA = requireNumber(ctx, details, "totalCGPA", "Total CGPA", { min: 0.1, max: 10 });
  const obtainedCGPA = requireNumber(ctx, details, "obtainedCGPA", "Obtained CGPA", { min: 0, max: 10 });

  if (totalCGPA !== null && obtainedCGPA !== null && obtainedCGPA > totalCGPA) {
    addIssue(ctx, "educationDetails.obtainedCGPA", "Obtained CGPA cannot exceed total CGPA");
  }
};

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  nativeVillage: z.string().trim().min(1, "Please select a native village"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const updateProfileSchema = z.object({
  nativeVillage: z.string().trim().min(1, "Please select a native village"),
});

const uploadResultSchema = z
  .object({
    studentName: z.string().trim().min(2, "Student name required").max(100),
    examYear: optionalText(10),
    category: z.enum(RESULT_CATEGORIES, {
      errorMap: () => ({ message: "Please select a valid result category" }),
    }),
    subCategory: optionalText(100),
    stream: optionalText(100),
    course: optionalText(150),
    description: optionalText(1000),
    educationDetails: educationDetailsSchema,
  })
  .superRefine((data, ctx) => {
    if (typeof data.educationDetails !== "object" || Array.isArray(data.educationDetails)) {
      addIssue(ctx, "educationDetails", "Education details must be a valid object");
      return;
    }

    const details = data.educationDetails;

    if (data.category === "1st-10th") {
      requireTopLevelText(ctx, data, "subCategory", "Standard", STANDARDS);
      requireNumber(ctx, details, "percentileRank", "Percentile rank", { min: 0, max: 100 });
      requireMarks(ctx, details);
      requireText(ctx, details, "schoolName", "School name");
    }

    if (data.category === "11th-12th & Diploma") {
      requireTopLevelText(ctx, data, "subCategory", "Education type", HIGHER_SECONDARY_TYPES);

      if (data.subCategory === "11th" || data.subCategory === "12th") {
        requireTopLevelText(ctx, data, "stream", "Stream", STREAMS);
        requireNumber(ctx, details, "percentileRank", "Percentile rank", { min: 0, max: 100 });
        requireMarks(ctx, details);
        requireText(ctx, details, "schoolName", "School name");
      }

      if (data.subCategory === "Diploma") {
        requireTopLevelText(ctx, data, "course", "Diploma course", DIPLOMA_COURSES);
        requireText(ctx, details, "collegeName", "College name");
        requireCgpa(ctx, details);
      }
    }

    if (data.category === "Undergraduate") {
      requireTopLevelText(ctx, data, "course", "Course", UNDERGRADUATE_COURSES);
      requireText(ctx, details, "collegeName", "College name");
      requireCgpa(ctx, details);
    }

    if (data.category === "Postgraduate") {
      requireTopLevelText(ctx, data, "course", "Course", POSTGRADUATE_COURSES);
      requireText(ctx, details, "collegeName", "College name");
      requireCgpa(ctx, details);
    }

    if (data.category === "Government Exams") {
      requireText(ctx, details, "qualifiedExamName", "Qualified government exam name", GOVERNMENT_EXAMS);
      optionalNumber(ctx, details, "rank", "Rank", { min: 1 });
      requireMarks(ctx, details, false);
    }
  });

const updateStatusSchema = z.object({
  status: z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "Status must be approved or rejected" }),
  }),
  rejectionReason: z.string().max(500).optional(),
  reviewComments: z.string().max(1000).optional(),
});

const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    const errors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return res.status(400).json({ success: false, errors });
  }
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  uploadResultSchema,
  updateStatusSchema,
};
