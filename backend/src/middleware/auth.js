const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT token
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated. Please log in." });
    }

    let token;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token) {
      token = req.query.token; // fallback for browser tab opens
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated. Please log in." });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "User no longer exists." });
    }
    if (user.isActive === false) {
      return res
        .status(403)
        .json({ success: false, error: "Your account is disabled." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired token." });
  }
};

// Restrict to specific roles
const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(" or ")}.`,
      });
    }
    next();
  };

const hasPermission =
  (...permissions) =>
  (req, res, next) => {
    if (req.user.role === "super_admin") return next();
    const allowed = permissions.every((permission) => req.user.hasPermission(permission));
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: `Missing required permission: ${permissions.join(", ")}`,
      });
    }
    next();
  };

module.exports = { protect, restrictTo, hasPermission };
