const Notification = require("../models/Notification");
const Result = require("../models/Result");

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

const getAudienceFilter = async (user) => {
  const village = user.nativeVillage || user.village || "";
  const assignedCategories = Array.isArray(user.assignedCategories) ? user.assignedCategories.filter(Boolean) : [];
  const selectedUserMatchers = [user.email, String(user._id)];

  const filters = [];

  if (user.role === "student") {
    filters.push({ audience: "all_students" });

    if (village) {
      filters.push({
        audience: "village",
        "metadata.village": village,
      });
    }

    const studentCategories = await Result.distinct("category", {
      userId: user._id,
      category: { $ne: "" },
    });

    if (studentCategories.length) {
      filters.push({
        audience: "category",
        "metadata.category": { $in: studentCategories },
      });
    }
  }

  if (["teacher", "admin", "super_admin"].includes(user.role)) {
    filters.push({ audience: "all_teachers" });

    if (village && user.role === "teacher") {
      filters.push({
        audience: "village",
        "metadata.village": village,
      });
    }

    if (assignedCategories.length) {
      filters.push({
        audience: "category",
        "metadata.category": { $in: assignedCategories },
      });
    }
  }

  filters.push({
    audience: "selected_users",
    "metadata.selectedUsers": { $in: selectedUserMatchers },
  });

  return { $or: filters };
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
    const notifications = await Notification.find(await getAudienceFilter(req.user))
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
    const audienceFilter = await getAudienceFilter(req.user);
    const filter = ids.length
      ? { _id: { $in: ids }, "readBy.userId": { $ne: req.user._id }, ...audienceFilter }
      : { ...audienceFilter, "readBy.userId": { $ne: req.user._id } };

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
