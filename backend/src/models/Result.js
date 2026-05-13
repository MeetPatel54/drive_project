const mongoose = require("mongoose");

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
      required: [true, "Percentage is required"],
      min: [0, "Percentage cannot be less than 0"],
      max: [100, "Percentage cannot exceed 100"],
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
      enum: ["pending", "approved", "rejected"],
      default: "pending",
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
    rejectionReason: {
      type: String,
      default: "",
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
resultSchema.index({ percentage: -1 });

module.exports = mongoose.model("Result", resultSchema);
