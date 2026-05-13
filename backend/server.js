require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "JWT_SECRET", "MONGODB_URI"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("❌ Missing env vars:", missing.join(", "));
  process.exit(1);
}

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📋 Auth API:    http://localhost:${PORT}/api/auth`);
    console.log(`📊 Results API: http://localhost:${PORT}/api/results`);
    console.log(`❤️  Health:      http://localhost:${PORT}/api/health`);
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      console.warn(`\n⚠️  Visit http://localhost:${PORT}/auth to get your Google refresh token`);
    }
    console.log(`\n💡 Run "npm run seed" to create the default teacher account\n`);
  });
});
