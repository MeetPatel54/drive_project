require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 3000;

// Validate required env vars on startup
const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("❌ Missing required environment variables:", missing.join(", "));
  process.exit(1);
}

if (!process.env.GOOGLE_REFRESH_TOKEN) {
  console.warn("⚠️  GOOGLE_REFRESH_TOKEN not set.");
  console.warn(`   Visit http://localhost:${PORT}/auth to authorize and get your token.`);
}

if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
  console.warn("⚠️  GOOGLE_DRIVE_FOLDER_ID not set. Uploads will fail until configured.");
}

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📁 API:    http://localhost:${PORT}/api/media`);
  console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Auth:   http://localhost:${PORT}/auth  (first-time setup only)\n`);
});