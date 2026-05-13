const User = require("../models/User");
const { sendToken } = require("../utils/token");

// POST /api/auth/register — students only
const register = async (req, res) => {
  try {
    const { name, email, password, village } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Email already registered." });
    }

    const user = await User.create({
      name,
      email,
      password,
      village: village || "",
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
      village: req.user.village,
    },
  });
};

module.exports = { register, login, getMe };
