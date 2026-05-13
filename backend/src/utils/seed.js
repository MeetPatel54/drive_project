require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const connectDB = require("../config/db");

const seed = async () => {
  await connectDB();

  // Check if teacher already exists
  const existing = await User.findOne({ email: "teacher@school.com" });
  if (existing) {
    console.log("⚠️  Teacher account already exists: teacher@school.com");
    process.exit(0);
  }

  await User.create({
    name: "Head Teacher",
    email: "teacher@school.com",
    password: "teacher123",
    role: "teacher",
    village: "",
  });

  console.log("✅ Default teacher account created:");
  console.log("   Email:    teacher@school.com");
  console.log("   Password: teacher123");
  console.log("   ⚠️  Change this password immediately in production!");

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
