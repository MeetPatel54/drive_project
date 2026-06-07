const mongoose = require("mongoose");

const RESULT_CATEGORIES = [
  "1st-10th",
  "11th-12th & Diploma",
  "Undergraduate",
  "Postgraduate",
  "Government Exams",
];

const resultSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: [true, "Student name is required"],
      trim: true,
    },
    village: {
      type: String,
      trim: true,
      default: "",
    },
    percentage: {
      type: Number,
      default: null,
      min: [0, "Percentage cannot be less than 0"],
      max: [100, "Percentage cannot exceed 100"],
    },
    category: {
      type: String,
      enum: [...RESULT_CATEGORIES, ""],
      default: "",
    },
    subCategory: {
      type: String,
      trim: true,
      default: "",
    },
    stream: {
      type: String,
      trim: true,
      default: "",
    },
    course: {
      type: String,
      trim: true,
      default: "",
    },
    educationDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    grade: {
      type: String,
      trim: true,
      default: "",
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    examYear: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
    },
    reviewLock: {
      reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      lockedAt: {
        type: Date,
        default: null,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
    },
    driveFileId: {
      type: String,
      required: [true, "Drive file ID is required"],
    },
    driveLink: {
      type: String,
      required: [true, "Drive link is required"],
    },
    driveFolderName: {
      type: String,
      default: "",
    },
    originalFileName: {
      type: String,
      trim: true,
      default: "",
    },
    mimeType: {
      type: String,
      trim: true,
      default: "",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    rejectionReason: {
      type: String,
      default: "",
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewComments: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Index for fast lookups
resultSchema.index({ userId: 1 });
resultSchema.index({ status: 1 });
resultSchema.index({ "reviewLock.expiresAt": 1 });
resultSchema.index({ status: 1, "reviewLock.expiresAt": 1 });
resultSchema.index({ percentage: -1 });
resultSchema.index({ category: 1 });
resultSchema.index({ village: 1 });

module.exports = mongoose.model("Result", resultSchema);
