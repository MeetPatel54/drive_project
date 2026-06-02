const Notification = require("../models/Notification");

const toNotificationView = (notification, userId) => {
  const read = notification.readBy?.some((entry) => entry.userId?.toString() === userId.toString());

  return {
    id: notification._id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    priority: notification.priority,
    audience: notification.audience,
    metadata: notification.metadata || {},
    createdAt: notification.createdAt,
    read,
    createdBy: notification.createdBy,
    resultId: notification.resultId,
  };
};

const createCustomNotification = async (req, res) => {
  try {
    const title = req.body.title?.trim();
    const message = req.body.message?.trim();

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: "Title and message are required.",
      });
    }

    const notification = await Notification.create({
      title,
      message,
      type: "custom",
      priority: "high",
      audience: "all_students",
      createdBy: req.user._id,
    });

    await notification.populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (err) {
    console.error("createCustomNotification error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ audience: "all_students" })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("createdBy", "name email")
      .lean();

    const data = notifications.map((notification) => toNotificationView(notification, req.user._id));

    res.json({
      success: true,
      unreadCount: data.filter((notification) => !notification.read).length,
      data,
    });
  } catch (err) {
    console.error("getNotifications error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const filter = ids.length
      ? { _id: { $in: ids }, "readBy.userId": { $ne: req.user._id } }
      : { audience: "all_students", "readBy.userId": { $ne: req.user._id } };

    await Notification.updateMany(filter, {
      $push: { readBy: { userId: req.user._id, readAt: new Date() } },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("markNotificationsRead error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createCustomNotification,
  getNotifications,
  markNotificationsRead,
};
