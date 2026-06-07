const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/adminController");
const { protect, restrictTo, hasPermission } = require("../middleware/auth");

router.use(protect);
router.use(restrictTo("admin", "super_admin"));

router.get("/bootstrap", getAdminBootstrap);
router.get("/dashboard", hasPermission("view_analytics"), getAdminBootstrap);

router.get("/users", hasPermission("manage_users"), getAdminUsers);
router.post("/users/teachers", hasPermission("manage_users"), postTeacher);
router.patch("/users/:id", hasPermission("manage_users"), patchUser);
router.patch("/users/:id/reset-password", hasPermission("manage_users"), patchUserPassword);

router.get("/results", hasPermission("manage_results"), getAdminResults);
router.patch("/results/:id", hasPermission("manage_results"), patchAdminResult);

router.get("/reviews", hasPermission("manage_results"), getReviewMonitoringAdmin);
router.post("/reviews/:id/force-release", hasPermission("manage_results"), forceReleaseReviewLock);
router.post("/reviews/:id/reassign", hasPermission("manage_results"), reassignReview);

router.get("/storage", hasPermission("manage_storage"), getStorageAdmin);
router.post("/storage/:action", hasPermission("manage_storage"), actionStorageAdmin);

router.get("/notifications", hasPermission("manage_notifications"), getNotificationAdmin);
router.post("/notifications", hasPermission("manage_notifications"), postNotificationAdmin);
router.patch("/notifications/:id", hasPermission("manage_notifications"), patchNotificationAdmin);
router.post("/notifications/:id/resend", hasPermission("manage_notifications"), resendNotificationAdmin);

router.get("/villages", hasPermission("manage_villages"), getVillageAdmin);
router.post("/villages", hasPermission("manage_villages"), postVillageAdmin);
router.patch("/villages/:id", hasPermission("manage_villages"), patchVillageAdmin);

router.get("/categories", hasPermission("manage_categories"), getCategoryAdmin);
router.post("/categories", hasPermission("manage_categories"), postCategoryAdmin);
router.patch("/categories/:id", hasPermission("manage_categories"), patchCategoryAdmin);

router.get("/institutions", hasPermission("manage_institutions"), getInstitutionAdmin);
router.post("/institutions", hasPermission("manage_institutions"), postInstitutionAdmin);
router.patch("/institutions/:id", hasPermission("manage_institutions"), patchInstitutionAdmin);
router.post("/institutions/merge", hasPermission("manage_institutions"), mergeInstitutionAdmin);

router.get("/analytics", hasPermission("view_analytics"), getAnalyticsAdmin);
router.get("/audit-logs", hasPermission("view_audit_logs"), getAuditLogsAdmin);
router.get("/system-health", hasPermission("view_system_health"), getSystemHealthAdmin);
router.get("/backups/:type", hasPermission("view_audit_logs"), getBackupsAdmin);
router.get("/moderation", hasPermission("manage_results"), getModerationAdmin);
router.patch("/moderation/:id", hasPermission("manage_results"), patchModerationAdmin);

module.exports = router;
