const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const USER_PERMISSIONS = [
  "manage_users",
  "manage_results",
  "manage_villages",
  "manage_categories",
  "manage_notifications",
  "manage_institutions",
  "view_analytics",
  "view_audit_logs",
  "manage_storage",
  "view_system_health",
];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // never return password by default
    },
    role: {
      type: String,
      enum: ["student", "teacher", "admin", "super_admin"],
      default: "student",
    },
    permissions: {
      type: [String],
      enum: USER_PERMISSIONS,
      default: [],
    },
    assignedCategories: {
      type: [String],
      default: [],
    },
    assignedVillages: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    village: {
      type: String,
      trim: true,
      default: "",
    },
    nativeVillage: {
      type: String,
      required: function () {
        return this.role === "student";
      },
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.hasPermission = function (permission) {
  return this.role === "super_admin" || this.permissions.includes(permission);
};

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ nativeVillage: 1 });
userSchema.index({ lastLoginAt: -1 });

module.exports = mongoose.model("User", userSchema);
