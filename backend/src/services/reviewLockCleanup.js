const { clearExpiredReviewLocks } = require("../controllers/resultController");

let timer = null;

const startReviewLockCleanup = () => {
  if (timer) return;

  timer = setInterval(async () => {
    try {
      await clearExpiredReviewLocks();
    } catch (err) {
      console.error("review lock cleanup error:", err.message);
    }
  }, 60 * 1000);

  timer.unref?.();
};

module.exports = { startReviewLockCleanup };
