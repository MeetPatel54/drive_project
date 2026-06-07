const AuditLog = require("../models/AuditLog");

const writeAuditLog = async ({ userId = null, action, module, targetId = "", ip = "", metadata = {} }) =>
  AuditLog.create({
    userId,
    action,
    module,
    targetId: targetId ? String(targetId) : "",
    ip,
    metadata,
  });

const listAuditLogs = async ({ search = "", module, page = 1, limit = 20 }) => {
  const filter = {};
  if (module) filter.module = module;
  if (search) {
    filter.$or = [
      { action: { $regex: search, $options: "i" } },
      { module: { $regex: search, $options: "i" } },
      { targetId: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate("userId", "name email role")
      .lean(),
  ]);

  return {
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / parseInt(limit, 10)),
    data: logs,
  };
};

module.exports = {
  writeAuditLog,
  listAuditLogs,
};
