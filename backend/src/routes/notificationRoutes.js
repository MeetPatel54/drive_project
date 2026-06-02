const express = require("express");
const router = express.Router();
const {
  createCustomNotification,
  getNotifications,
  markNotificationsRead,
} = require("../controllers/notificationController");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect);

router.get("/", restrictTo("student"), getNotifications);
router.patch("/read", restrictTo("student"), markNotificationsRead);
router.post("/", restrictTo("teacher"), createCustomNotification);

module.exports = router;
