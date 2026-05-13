const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  village: z.string().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const uploadResultSchema = z.object({
  studentName: z.string().min(2, "Student name required").max(100),
  village: z.string().max(100).optional(),
  percentage: z
    .string()
    .transform(Number)
    .pipe(z.number().min(0).max(100, "Percentage must be 0–100")),
  grade: z.string().max(10).optional(),
  subject: z.string().max(100).optional(),
  examYear: z.string().max(10).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["approved", "rejected"], {
    errorMap: () => ({ message: "Status must be approved or rejected" }),
  }),
  rejectionReason: z.string().max(500).optional(),
});

const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
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
  uploadResultSchema,
  updateStatusSchema,
};
