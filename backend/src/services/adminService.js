const os = require("os");
const User = require("../models/User");
const Result = require("../models/Result");
const Notification = require("../models/Notification");
const Village = require("../models/Village");
const Category = require("../models/Category");
const Institution = require("../models/Institution");
const { aggregateAdminAnalytics } = require("./analyticsService");
const { getStorageSummary } = require("./storageService");
const { getModerationQueue } = require("./moderationService");
const { listAuditLogs } = require("./auditService");
const { normalizeName, slugify } = require("../utils/normalizers");

const ADMIN_PERMISSIONS = [
  "manage_users",
  "manage_results",
  "manage_villages",
  "manage_categories",
  "manage_notifications",
  "manage_institutions",
  "view_analytics",
  "view_audit_logs",
  "manage_storage",
  "view_system_health",
];

const buildUserFilter = (query = {}) => {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.village) filter.$or = [{ village: query.village }, { nativeVillage: query.village }];
  if (query.status) filter.isActive = query.status === "active";
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { email: { $regex: query.search, $options: "i" } },
    ];
  }
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  return filter;
};

const paginate = (page = 1, limit = 20) => ({
  page: parseInt(page, 10),
  limit: parseInt(limit, 10),
  skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
});

const getAdminDashboard = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalStudents,
    totalTeachers,
    totalResults,
    pendingReviews,
    underReview,
    approvedResults,
    rejectedResults,
    totalVillages,
    totalSchools,
    totalColleges,
    notificationsSent,
    activeUsersToday,
    storage,
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: { $in: ["teacher", "admin", "super_admin"] } }),
    Result.countDocuments(),
    Result.countDocuments({ status: "pending" }),
    Result.countDocuments({ status: "under_review" }),
    Result.countDocuments({ status: "approved" }),
    Result.countDocuments({ status: "rejected" }),
    Village.countDocuments({ status: "active" }),
    Institution.countDocuments({ type: "school", status: "active" }),
    Institution.countDocuments({ type: "college", status: "active" }),
    Notification.countDocuments(),
    User.countDocuments({ lastLoginAt: { $gte: todayStart } }),
    getStorageSummary(),
  ]);

  return {
    totalStudents,
    totalTeachers,
    totalResults,
    pendingReviews,
    underReview,
    approvedResults,
    rejectedResults,
    totalVillages,
    totalSchools,
    totalColleges,
    storageUsed: storage.storageUsed,
    activeUsersToday,
    notificationsSent,
  };
};

const listUsers = async (query) => {
  const { page, limit, skip } = paginate(query.page, query.limit);
  const filter = buildUserFilter(query);
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return { total, page, totalPages: Math.ceil(total / limit), data: users };
};

const createTeacher = async ({ name, email, password, assignedCategories = [], assignedVillages = [], permissions = [] }) =>
  User.create({
    name,
    email,
    password,
    role: "teacher",
    assignedCategories,
    assignedVillages,
    permissions: permissions.filter((permission) => ADMIN_PERMISSIONS.includes(permission)),
    village: "",
    nativeVillage: "",
  });

const updateUser = async (id, payload) =>
  User.findByIdAndUpdate(
    id,
    {
      $set: {
        name: payload.name,
        email: payload.email,
        role: payload.role,
        isActive: payload.isActive,
        permissions: payload.permissions || [],
        assignedCategories: payload.assignedCategories || [],
        assignedVillages: payload.assignedVillages || [],
        nativeVillage: payload.nativeVillage || "",
        village: payload.nativeVillage || payload.village || "",
      },
    },
    { new: true, runValidators: true }
  );

const resetUserPassword = async (id, password) => {
  const user = await User.findById(id).select("+password");
  if (!user) return null;
  user.password = password;
  await user.save();
  return user;
};

const listAdminResults = async (query) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.village) filter.village = query.village;
  if (query.category) filter.category = query.category;
  if (query.teacher) filter.reviewedBy = query.teacher;
  if (query.search) {
    filter.$or = [
      { studentName: { $regex: query.search, $options: "i" } },
      { subject: { $regex: query.search, $options: "i" } },
      { course: { $regex: query.search, $options: "i" } },
    ];
  }
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const { page, limit, skip } = paginate(query.page, query.limit);
  const [total, results] = await Promise.all([
    Result.countDocuments(filter),
    Result.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email role")
      .populate("reviewedBy", "name email")
      .populate("reviewLock.reviewerId", "name email")
      .lean(),
  ]);

  return { total, page, totalPages: Math.ceil(total / limit), data: results };
};

const updateResultAdmin = async (id, patch) =>
  Result.findByIdAndUpdate(id, patch, { new: true })
    .populate("userId", "name email role")
    .populate("reviewedBy", "name email")
    .populate("reviewLock.reviewerId", "name email");

const getReviewMonitoring = async () => {
  const [lockedResults, teacherStats] = await Promise.all([
    Result.find({ status: "under_review" })
      .populate("reviewLock.reviewerId", "name email")
      .lean(),
    Result.aggregate([
      { $match: { reviewedBy: { $ne: null } } },
      {
        $group: {
          _id: "$reviewedBy",
          approvedCount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          rejectedCount: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
          pendingReviews: { $sum: { $cond: [{ $eq: ["$status", "under_review"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "teacher",
        },
      },
      { $unwind: "$teacher" },
      {
        $project: {
          _id: 1,
          reviewerName: "$teacher.name",
          approvedCount: 1,
          rejectedCount: 1,
          pendingReviews: 1,
          avgReviewTime: { $literal: 0 },
        },
      },
    ]),
  ]);

  return { lockedResults, teacherStats };
};

const getVillageModule = async () => Village.find({}).sort({ name: 1 }).lean();
const getCategoryModule = async () => Category.find({}).sort({ name: 1 }).lean();
const getInstitutionModule = async () => Institution.find({}).sort({ type: 1, name: 1 }).lean();
const getSystemHealth = async () => ({
  serverStatus: "ok",
  mongoStatus: "connected",
  googleDriveStatus: "configured",
  apiHealth: "healthy",
  uptime: process.uptime(),
  memoryUsage: process.memoryUsage().heapUsed,
  failedUploadCount: 0,
  hostname: os.hostname(),
});

const createVillage = async ({ name, createdBy }) => Village.create({ name, createdBy });
const updateVillage = async (id, payload) => Village.findByIdAndUpdate(id, { $set: payload }, { new: true });

const createCategory = async ({ name, createdBy }) => Category.create({ name, slug: slugify(name), createdBy });
const updateCategory = async (id, payload) => Category.findByIdAndUpdate(id, { $set: { ...payload, slug: payload.name ? slugify(payload.name) : payload.slug } }, { new: true });

const createInstitution = async ({ name, type, createdBy }) =>
  Institution.create({
    name,
    type,
    normalizedName: normalizeName(name),
    aliases: [],
    createdBy,
  });

const updateInstitution = async (id, payload) =>
  Institution.findByIdAndUpdate(
    id,
    {
      $set: {
        ...payload,
        normalizedName: payload.name ? normalizeName(payload.name) : undefined,
      },
    },
    { new: true }
  );

const mergeInstitutions = async ({ primaryId, duplicateIds = [] }) => {
  const primary = await Institution.findById(primaryId);
  if (!primary) return null;

  const duplicates = await Institution.find({ _id: { $in: duplicateIds } });
  const aliases = [...new Set([...primary.aliases, ...duplicates.map((item) => item.name)])];
  primary.aliases = aliases;
  await primary.save();
  await Institution.deleteMany({ _id: { $in: duplicateIds } });
  return primary;
};

const getNotificationAdminSummary = async () => {
  const notifications = await Notification.find({})
    .sort({ createdAt: -1 })
    .populate("createdBy", "name email")
    .lean();
  return notifications;
};

module.exports = {
  ADMIN_PERMISSIONS,
  aggregateAdminAnalytics,
  createCategory,
  createInstitution,
  createTeacher,
  createVillage,
  getAdminDashboard,
  getCategoryModule,
  getInstitutionModule,
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
  getModerationQueue,
};