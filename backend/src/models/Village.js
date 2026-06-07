const mongoose = require("mongoose");

const villageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Village name is required"],
      trim: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Village", villageSchema);
