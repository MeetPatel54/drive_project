const express = require("express");
const cors = require("cors");
const path = require("path");
const { getAuthUrl, getTokensFromCode } = require("./config/google");
const mediaRoutes = require("./routes/mediaRoutes");

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files (will be added later)
app.use(express.static(path.join(__dirname, "../public")));

// ── Google OAuth routes (one-time setup to get refresh token) ───────────────
// Step 1: Visit this URL in browser → it redirects to Google consent screen
app.get("/auth", (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

// Step 2: Google redirects here with ?code=...
// Copy the refresh_token from the response and put it in your .env
app.get("/auth/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Missing authorization code");

    const tokens = await getTokensFromCode(code);
    res.json({
      message: "✅ Auth successful! Copy the refresh_token below into your .env file.",
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API routes ──────────────────────────────────────────────────────────────
app.use("/api/media", mediaRoutes);

// ── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    driveFolderConfigured: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    authConfigured: !!process.env.GOOGLE_REFRESH_TOKEN,
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