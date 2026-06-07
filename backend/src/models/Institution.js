const mongoose = require("mongoose");

const institutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Institution name is required"],
      trim: true,
    },
    normalizedName: {
      type: String,
      required: [true, "Normalized institution name is required"],
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["school", "college"],
      required: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    approved: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

institutionSchema.index({ normalizedName: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Institution", institutionSchema);
