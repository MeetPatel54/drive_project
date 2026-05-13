const express = require("express");
const cors = require("cors");
const { getAuthUrl, getTokensFromCode } = require("./config/google");
const authRoutes = require("./routes/authRoutes");
const resultRoutes = require("./routes/resultRoutes");

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Google Auth (one-time setup) ────────────────────────────────────────────
app.get("/auth", (req, res) => res.redirect(getAuthUrl()));
app.get("/auth/callback", async (req, res) => {
  try {
    const tokens = await getTokensFromCode(req.query.code);
    res.json({
      message: "✅ Copy this refresh_token into your .env",
      refresh_token: tokens.refresh_token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth",    authRoutes);
app.use("/api/results", resultRoutes);

// ── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mongo: require("mongoose").connection.readyState === 1 ? "connected" : "disconnected",
    driveConfigured: !!process.env.GOOGLE_DRIVE_FOLDER_ID && !!process.env.GOOGLE_REFRESH_TOKEN,
  });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

module.exports = app;
