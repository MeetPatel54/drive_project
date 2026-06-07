const User = require("../models/User");
const { sendToken } = require("../utils/token");

// POST /api/auth/register — students only
const register = async (req, res) => {
  try {
    const { name, email, password, nativeVillage } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Email already registered." });
    }

    const user = await User.create({
      name,
      email,
      password,
      village: nativeVillage,
      nativeVillage,
      role: "student", // registration always creates students
    });

    sendToken(user, 201, res);
  } catch (err) {
    console.error("register error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/auth/login — students + teachers
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, error: "Invalid email or password." });
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    sendToken(user, 200, res);
  } catch (err) {
    console.error("login error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/auth/me — get current user
const getMe = async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      permissions: req.user.permissions || [],
      assignedCategories: req.user.assignedCategories || [],
      assignedVillages: req.user.assignedVillages || [],
      isActive: req.user.isActive !== false,
      village: req.user.nativeVillage || req.user.village,
      nativeVillage: req.user.nativeVillage || req.user.village,
    },
  });
};

// PATCH /api/auth/me — complete/update student profile
const updateMe = async (req, res) => {
  try {
    const { nativeVillage } = req.body;

    req.user.nativeVillage = nativeVillage;
    req.user.village = nativeVillage;
    await req.user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions || [],
        assignedCategories: req.user.assignedCategories || [],
        assignedVillages: req.user.assignedVillages || [],
        isActive: req.user.isActive !== false,
        village: req.user.nativeVillage || req.user.village,
        nativeVillage: req.user.nativeVillage || req.user.village,
      },
    });
  } catch (err) {
    console.error("updateMe error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { register, login, getMe, updateMe };
