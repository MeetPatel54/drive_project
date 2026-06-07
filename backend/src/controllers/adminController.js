const Notification = require("../models/Notification");
const {
  ADMIN_PERMISSIONS,
  aggregateAdminAnalytics,
  createCategory,
  createInstitution,
  createTeacher,
  createVillage,
  getAdminDashboard,
  getCategoryModule,
  getInstitutionModule,
  getModerationQueue,
  getNotificationAdminSummary,
  getReviewMonitoring,
  getStorageSummary,
  getSystemHealth,
  getVillageModule,
  listAdminResults,
  listAuditLogs,
  listUsers,
  mergeInstitutions,
  resetUserPassword,
  updateCategory,
  updateInstitution,
  updateResultAdmin,
  updateUser,
  updateVillage,
} = require("../services/adminService");
const { writeAuditLog } = require("../services/auditService");

const getAdminBootstrap = async (req, res) => {
  try {
    const [dashboard, analytics, villages, categories, institutions, notifications, reviewMonitoring, storage, moderation, auditLogs, systemHealth] =
      await Promise.all([
        getAdminDashboard(),
        aggregateAdminAnalytics(),
        getVillageModule(),
        getCategoryModule(),
        getInstitutionModule(),
        getNotificationAdminSummary(),
        getReviewMonitoring(),
        getStorageSummary(),
        getModerationQueue(),
        listAuditLogs({ page: 1, limit: 20 }),
        getSystemHealth(),
      ]);

    res.json({
      success: true,
      data: {
        dashboard,
        analytics,
        villages,
        categories,
        institutions,
        notifications,
        reviewMonitoring,
        storage,
        moderation,
        auditLogs,
        systemHealth,
        permissions: ADMIN_PERMISSIONS,
      },
    });
  } catch (err) {
    console.error("getAdminBootstrap error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getAdminUsers = async (req, res) => {
  try {
    const data = await listUsers(req.query);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("getAdminUsers error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const postTeacher = async (req, res) => {
  try {
    const teacher = await createTeacher(req.body);
    await writeAuditLog({
      userId: req.user._id,
      action: "create_teacher",
      module: "users",
      targetId: teacher._id,
      ip: req.ip,
    });
    res.status(201).json({ success: true, data: teacher });
  } catch (err) {
    console.error("postTeacher error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const patchUser = async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    await writeAuditLog({
      userId: req.user._id,
      action: "update_user",
      module: "users",
      targetId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, data: user });
  } catch (err) {
    console.error("patchUser error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const patchUserPassword = async (req, res) => {
  try {
    const user = await resetUserPassword(req.params.id, req.body.password);
    await writeAuditLog({
      userId: req.user._id,
      action: "reset_password",
      module: "users",
      targetId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, data: user });
  } catch (err) {
    console.error("patchUserPassword error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getAdminResults = async (req, res) => {
  try {
    const data = await listAdminResults(req.query);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("getAdminResults error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const patchAdminResult = async (req, res) => {
  try {
    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.archive === true) {
      updates.archivedAt = new Date();
      updates.archivedBy = req.user._id;
    }
    if (req.body.archive === false) {
      updates.archivedAt = null;
      updates.archivedBy = null;
    }
    if (req.body.reassignReviewer) updates.reviewedBy = req.body.reassignReviewer;
    if (req.body.delete === true) {
      updates.deletedAt = new Date();
      updates.deletedBy = req.user._id;
    }
    if (req.body.restore === true) {
      updates.deletedAt = null;
      updates.deletedBy = null;
    }

    const result = await updateResultAdmin(req.params.id, { $set: updates });
    await writeAuditLog({
      userId: req.user._id,
      action: "update_result",
      module: "results",
      targetId: req.params.id,
      ip: req.ip,
      metadata: updates,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("patchAdminResult error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getReviewMonitoringAdmin = async (req, res) => {
  try {
    const data = await getReviewMonitoring();
    res.json({ success: true, data });
  } catch (err) {
    console.error("getReviewMonitoringAdmin error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const forceReleaseReviewLock = async (req, res) => {
  try {
    const result = await updateResultAdmin(req.params.id, {
      $set: { status: "pending" },
      $unset: { reviewLock: "" },
    });
    await writeAuditLog({
      userId: req.user._id,
      action: "force_release_lock",
      module: "reviews",
      targetId: req.params.id,
      ip: req.ip,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("forceReleaseReviewLock error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const reassignReview = async (req, res) => {
  try {
    const result = await updateResultAdmin(req.params.id, {
      $set: { reviewedBy: req.body.reviewerId },
    });
    await writeAuditLog({
      userId: req.user._id,
      action: "reassign_result",
      module: "reviews",
      targetId: req.params.id,
      ip: req.ip,
      metadata: { reviewerId: req.body.reviewerId },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("reassignReview error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getStorageAdmin = async (req, res) => {
  try {
    res.json({ success: true, data: await getStorageSummary() });
  } catch (err) {
    console.error("getStorageAdmin error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const actionStorageAdmin = async (req, res) => {
  try {
    await writeAuditLog({
      userId: req.user._id,
      action: req.params.action,
      module: "storage",
      targetId: "",
      ip: req.ip,
    });
    res.json({ success: true, message: `${req.params.action} completed.` });
  } catch (err) {
    console.error("actionStorageAdmin error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getNotificationAdmin = async (req, res) => {
  try {
    res.json({ success: true, data: await getNotificationAdminSummary() });
  } catch (err) {
    console.error("getNotificationAdmin error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const postNotificationAdmin = async (req, res) => {
  try {
    const audience = req.body.audience || "all_students";
    const notification = await Notification.create({
      title: req.body.title,
      message: req.body.message,
      type: req.body.deliveryType === "auto" ? "auto" : "custom",
      priority: ["urgent", "important"].includes(req.body.notificationType) ? "high" : "normal",
      audience,
      metadata: {
        notificationType: req.body.notificationType || "general",
        village: req.body.village || "",
        category: req.body.category || "",
        selectedUsers: req.body.selectedUsers || [],
        scheduledAt: req.body.scheduledAt || null,
        draft: !!req.body.draft,
      },
      createdBy: req.user._id,
    });
    await writeAuditLog({
      userId: req.user._id,
      action: "send_notification",
      module: "notifications",
      targetId: notification._id,
      ip: req.ip,
    });
    res.status(201).json({ success: true, data: notification });
  } catch (err) {
    console.error("postNotificationAdmin error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const patchNotificationAdmin = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json({ success: true, data: notification });
  } catch (err) {
    console.error("patchNotificationAdmin error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const resendNotificationAdmin = async (req, res) => {
  try {
    const original = await Notification.findById(req.params.id);
    const copy = await Notification.create({
      title: original.title,
      message: original.message,
      type: "custom",
      priority: original.priority,
      audience: original.audience,
      metadata: { ...original.metadata, resentFrom: original._id },
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: copy });
  } catch (err) {
    console.error("resendNotificationAdmin error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getVillageAdmin = async (req, res) => res.json({ success: true, data: await getVillageModule() });
const postVillageAdmin = async (req, res) => res.status(201).json({ success: true, data: await createVillage({ ...req.body, createdBy: req.user._id }) });
const patchVillageAdmin = async (req, res) => res.json({ success: true, data: await updateVillage(req.params.id, req.body) });

const getCategoryAdmin = async (req, res) => res.json({ success: true, data: await getCategoryModule() });
const postCategoryAdmin = async (req, res) => res.status(201).json({ success: true, data: await createCategory({ ...req.body, createdBy: req.user._id }) });
const patchCategoryAdmin = async (req, res) => res.json({ success: true, data: await updateCategory(req.params.id, req.body) });

const getInstitutionAdmin = async (req, res) => res.json({ success: true, data: await getInstitutionModule() });
const postInstitutionAdmin = async (req, res) => res.status(201).json({ success: true, data: await createInstitution({ ...req.body, createdBy: req.user._id }) });
const patchInstitutionAdmin = async (req, res) => res.json({ success: true, data: await updateInstitution(req.params.id, req.body) });
const mergeInstitutionAdmin = async (req, res) => res.json({ success: true, data: await mergeInstitutions(req.body) });

const getAnalyticsAdmin = async (req, res) => res.json({ success: true, data: await aggregateAdminAnalytics() });
const getAuditLogsAdmin = async (req, res) => res.json({ success: true, ...(await listAuditLogs(req.query)) });
const getSystemHealthAdmin = async (req, res) => res.json({ success: true, data: await getSystemHealth() });
const getBackupsAdmin = async (req, res) => res.json({ success: true, data: { type: req.params.type, generatedAt: new Date().toISOString() } });
const getModerationAdmin = async (req, res) => res.json({ success: true, data: await getModerationQueue() });
const patchModerationAdmin = async (req, res) => res.json({ success: true, data: { resultId: req.params.id, status: req.body.status || "resolved" } });

module.exports = {
  forceReleaseReviewLock,
  getAdminBootstrap,
  getAdminResults,
  getAdminUsers,
  getAnalyticsAdmin,
  getAuditLogsAdmin,
  getBackupsAdmin,
  getCategoryAdmin,
  getInstitutionAdmin,
  getModerationAdmin,
  getNotificationAdmin,
  getReviewMonitoringAdmin,
  getStorageAdmin,
  getSystemHealthAdmin,
  getVillageAdmin,
  mergeInstitutionAdmin,
  patchAdminResult,
  patchCategoryAdmin,
  patchInstitutionAdmin,
  patchModerationAdmin,
  patchNotificationAdmin,
  patchUser,
  patchUserPassword,
  patchVillageAdmin,
  postCategoryAdmin,
  postInstitutionAdmin,
  postNotificationAdmin,
  postTeacher,
  postVillageAdmin,
  reassignReview,
  resendNotificationAdmin,
  actionStorageAdmin,
};
