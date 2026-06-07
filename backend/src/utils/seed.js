/**
 * seed.js — Full database seed for Student Result Platform
 *
 * Covers:
 *  - All user roles: super_admin, admin, teacher (with varied permissions), student
 *  - Villages, Categories, Institutions
 *  - Results in every status (pending, under_review, approved, rejected)
 *  - Populated educationDetails so analyticsService can pull schoolName / collegeName
 *  - Notifications (custom + auto, both priority levels, all audience types)
 *  - AuditLogs across every module and action
 *  - Realistic timestamps spread over last 90 days so trend charts have data
 *
 * Usage:
 *   node src/utils/seed.js            # safe – skips if data exists
 *   node src/utils/seed.js --force    # wipes collections and re-seeds
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const User = require("../models/User");
const Village = require("../models/Village");
const Category = require("../models/Category");
const Institution = require("../models/Institution");
const Result = require("../models/Result");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");

// ─── helpers ────────────────────────────────────────────────────────────────

const FORCE = process.argv.includes("--force");

const normalizeName = (v = "") =>
  v.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const slugify = (v = "") => normalizeName(v).replace(/\s+/g, "-");

/** Return a random date between `daysAgo` and `minDaysAgo` days in the past */
const daysAgo = (max, min = 0) => {
  const ms = (min + Math.random() * (max - min)) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const pickMany = (arr, n) => {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
};

const rnd = (min, max) => Math.round(min + Math.random() * (max - min));
const pct = (min = 40, max = 99) => Number((min + Math.random() * (max - min)).toFixed(1));

// ─── static reference data ──────────────────────────────────────────────────

const VILLAGE_NAMES = [
  "Anavada", "Bodana", "Chanasma", "Dholidhaja", "Ekalbara",
  "Fatepura", "Gozaria", "Harij", "Ilol", "Jotana",
  "Kherva", "Ladol", "Mahesana", "Nagalpur", "Ognaj",
  "Patdi", "Radhanpur", "Satlasana", "Thol", "Unjha",
  "Vadnagar", "Wanali", "Zinzuwada",
];

const CATEGORY_NAMES = [
  "1st-10th",
  "11th-12th & Diploma",
  "Undergraduate",
  "Postgraduate",
  "Government Exams",
];

const SCHOOLS = [
  "Shri Swaminarayan Vidyalaya", "Sardar Patel High School",
  "Mahila Vikas Vidyalaya", "Government Primary School Anavada",
  "Nutan High School", "Kendriya Vidyalaya Mehsana",
  "Gujarat Public School", "Eklavya Model School",
];

const COLLEGES = [
  "Mehsana Urban Cooperative College", "GPC Mehsana",
  "Hemchandracharya North Gujarat University",
  "Government Engineering College Mehsana",
  "S.P. College of Commerce", "B.K. Mody Government Pharmacy College",
  "Lokbharti Rural Institute", "RIMT College of Science",
];

const GOVT_EXAMS = ["GPSC Class-I/II", "UPSC Civil Services", "SSC CGL", "IBPS PO", "Gujarat Police Constable", "TET / TAT", "GSSSB Bin Sachivalay"];
const UG_COURSES = ["B.A.", "B.Com", "B.Sc", "B.Tech", "B.E.", "B.Pharm", "BBA", "BCA"];
const PG_COURSES = ["M.A.", "M.Com", "M.Sc", "M.Tech", "MBA", "MCA", "M.Ed"];
const STREAMS_11 = ["Science", "Commerce", "Arts"];
const GRADES_10 = ["A1", "A2", "B1", "B2", "C1", "C2", "D"];

// ─── seed execution ──────────────────────────────────────────────────────────

const seed = async () => {
  await connectDB();

  if (FORCE) {
    console.log("⚠️  --force: wiping existing data …");
    await Promise.all([
      User.deleteMany({}),
      Village.deleteMany({}),
      Category.deleteMany({}),
      Institution.deleteMany({}),
      Result.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    console.log("🗑️  Collections cleared.\n");
  }

  // ── 1. USERS ───────────────────────────────────────────────────────────────
  console.log("👤 Seeding users …");

  // Super Admin
  const superAdmin = await upsertUser({
    name: "Platform Super Admin",
    email: "admin@resultportal.com",
    password: "admin123",
    role: "super_admin",
    permissions: [
      "manage_users", "manage_results", "manage_villages",
      "manage_categories", "manage_notifications", "manage_institutions",
      "view_analytics", "view_audit_logs", "manage_storage", "view_system_health",
    ],
    village: "", nativeVillage: "",
    lastLoginAt: daysAgo(1),
  });

  // Regular Admin (limited permissions)
  const admin = await upsertUser({
    name: "Ravi Patel (Admin)",
    email: "ravi.admin@resultportal.com",
    password: "admin123",
    role: "admin",
    permissions: [
      "manage_users", "manage_results", "manage_notifications",
      "view_analytics", "view_audit_logs",
    ],
    village: "", nativeVillage: "",
    lastLoginAt: daysAgo(2),
  });

  // Teachers – varied permissions and village assignments
  const teacherDefs = [
    {
      name: "Bhavna Sharma",
      email: "bhavna.teacher@school.com",
      permissions: ["view_analytics", "manage_results"],
      assignedCategories: ["1st-10th", "11th-12th & Diploma"],
      assignedVillages: ["Anavada", "Bodana", "Chanasma"],
    },
    {
      name: "Mukesh Trivedi",
      email: "mukesh.teacher@school.com",
      permissions: ["manage_results"],
      assignedCategories: ["Undergraduate", "Postgraduate"],
      assignedVillages: ["Dholidhaja", "Ekalbara", "Fatepura"],
    },
    {
      name: "Savita Desai",
      email: "savita.teacher@school.com",
      permissions: ["view_analytics", "manage_results", "manage_notifications"],
      assignedCategories: ["Government Exams"],
      assignedVillages: ["Gozaria", "Harij", "Ilol"],
    },
    {
      name: "Jayesh Mehta",
      email: "jayesh.teacher@school.com",
      permissions: ["manage_results"],
      assignedCategories: ["1st-10th"],
      assignedVillages: ["Jotana", "Kherva", "Ladol"],
    },
    {
      name: "Priya Nair",
      email: "priya.teacher@school.com",
      permissions: ["view_analytics"],
      assignedCategories: ["Undergraduate"],
      assignedVillages: ["Mahesana", "Nagalpur"],
    },
  ];

  const teachers = [];
  for (const t of teacherDefs) {
    const u = await upsertUser({
      ...t,
      password: "teacher123",
      role: "teacher",
      village: "", nativeVillage: "",
      lastLoginAt: daysAgo(7),
    });
    teachers.push(u);
  }

  // Students – spread across many villages
  const studentDefs = generateStudentDefs(VILLAGE_NAMES, 60);
  const students = [];
  for (const s of studentDefs) {
    const u = await upsertUser({ ...s, password: "student123", role: "student" });
    students.push(u);
  }

  // Inactive / disabled student
  await upsertUser({
    name: "Deactivated User",
    email: "inactive@resultportal.com",
    password: "student123",
    role: "student",
    isActive: false,
    village: "Anavada", nativeVillage: "Anavada",
    lastLoginAt: null,
  });

  console.log(`   ✅ ${2 + teacherDefs.length + studentDefs.length + 1} users`);

  // ── 2. VILLAGES ────────────────────────────────────────────────────────────
  console.log("🏘️  Seeding villages …");
  const villages = [];
  for (const name of VILLAGE_NAMES) {
    const v = await upsertVillage(name, superAdmin._id);
    villages.push(v);
  }
  // One disabled village
  await upsertVillage("Zinzuwada", superAdmin._id, "disabled");
  console.log(`   ✅ ${VILLAGE_NAMES.length + 1} villages`);

  // ── 3. CATEGORIES ──────────────────────────────────────────────────────────
  console.log("📂 Seeding categories …");
  for (const name of CATEGORY_NAMES) {
    await Category.findOneAndUpdate(
      { slug: slugify(name) },
      { name, slug: slugify(name), status: "active", createdBy: superAdmin._id },
      { upsert: true, new: true }
    );
  }
  console.log(`   ✅ ${CATEGORY_NAMES.length} categories`);

  // ── 4. INSTITUTIONS ────────────────────────────────────────────────────────
  console.log("🏫 Seeding institutions …");
  for (const name of SCHOOLS) {
    await upsertInstitution(name, "school", superAdmin._id);
  }
  for (const name of COLLEGES) {
    await upsertInstitution(name, "college", superAdmin._id);
  }
  // One disabled school
  await Institution.findOneAndUpdate(
    { normalizedName: normalizeName("Old Decommissioned School") },
    { name: "Old Decommissioned School", normalizedName: normalizeName("Old Decommissioned School"), type: "school", status: "disabled", createdBy: superAdmin._id },
    { upsert: true, new: true }
  );
  console.log(`   ✅ ${SCHOOLS.length + COLLEGES.length + 1} institutions`);

  // ── 5. RESULTS ─────────────────────────────────────────────────────────────
  console.log("📊 Seeding results …");

  const FAKE_DRIVE_BASE = "1A2B3C4D5E6F7G8H9I";
  let resultCount = 0;

  const makeResult = (overrides = {}) => {
    const idx = resultCount++;
    return {
      driveFileId: `${FAKE_DRIVE_BASE}${idx}`,
      driveLink: `https://drive.google.com/file/d/${FAKE_DRIVE_BASE}${idx}/view`,
      driveFolderName: "Results",
      originalFileName: `result_${idx}.pdf`,
      mimeType: "application/pdf",
      fileSize: rnd(50000, 2000000),
      ...overrides,
    };
  };

  // Helper: create a result and set its timestamps manually
  const createResult = async (data) => {
    const r = new Result(data);
    const created = data._createdAt || daysAgo(90, 1);
    r.createdAt = created;
    r.updatedAt = data._updatedAt || created;
    delete r._createdAt; delete r._updatedAt;
    await r.save();
    // Bypass mongoose timestamps for realistic history
    await Result.collection.updateOne(
      { _id: r._id },
      { $set: { createdAt: created, updatedAt: data._updatedAt || created } }
    );
    return r;
  };

  // --- 1st–10th results (school category) ---
  for (let i = 0; i < 30; i++) {
    const student = pick(students);
    const teacher = pick(teachers);
    const village = student.nativeVillage || pick(VILLAGE_NAMES);
    const school = pick(SCHOOLS);
    const created = daysAgo(90, 2);
    const isApproved = Math.random() > 0.3;
    await createResult(makeResult({
      studentName: student.name,
      userId: student._id,
      village,
      category: "1st-10th",
      subCategory: String(rnd(1, 10)) + "th Standard",
      grade: pick(GRADES_10),
      percentage: pct(45, 98),
      examYear: String(pick([2022, 2023, 2024, 2025])),
      educationDetails: { schoolName: school, board: "GSEB", standard: String(rnd(1, 10)) },
      status: isApproved ? "approved" : pick(["pending", "under_review", "rejected"]),
      reviewedBy: isApproved ? teacher._id : (Math.random() > 0.5 ? teacher._id : null),
      reviewedAt: isApproved ? new Date(created.getTime() + rnd(1, 10) * 3600000) : null,
      reviewLock: { reviewerId: null, lockedAt: null, expiresAt: null },
      _createdAt: created,
    }));
  }

  // --- 11th–12th & Diploma results ---
  for (let i = 0; i < 20; i++) {
    const student = pick(students);
    const teacher = pick(teachers);
    const village = student.nativeVillage || pick(VILLAGE_NAMES);
    const isApproved = Math.random() > 0.25;
    const isDiploma = Math.random() > 0.6;
    const created = daysAgo(80, 1);
    await createResult(makeResult({
      studentName: student.name,
      userId: student._id,
      village,
      category: "11th-12th & Diploma",
      subCategory: isDiploma ? "Diploma" : pick(["11th", "12th"]),
      stream: isDiploma ? "Engineering" : pick(STREAMS_11),
      percentage: pct(40, 99),
      grade: pick(GRADES_10),
      examYear: String(pick([2023, 2024, 2025])),
      educationDetails: isDiploma
        ? { collegeName: pick(COLLEGES), course: "Diploma in Engineering" }
        : { schoolName: pick(SCHOOLS), board: "GSEB", stream: pick(STREAMS_11) },
      status: isApproved ? "approved" : pick(["pending", "under_review", "rejected"]),
      reviewedBy: isApproved ? teacher._id : null,
      reviewedAt: isApproved ? new Date(created.getTime() + rnd(1, 8) * 3600000) : null,
      reviewLock: { reviewerId: null, lockedAt: null, expiresAt: null },
      _createdAt: created,
    }));
  }

  // --- Undergraduate results ---
  for (let i = 0; i < 25; i++) {
    const student = pick(students);
    const teacher = pick(teachers);
    const village = student.nativeVillage || pick(VILLAGE_NAMES);
    const course = pick(UG_COURSES);
    const isApproved = Math.random() > 0.2;
    const created = daysAgo(70, 1);
    await createResult(makeResult({
      studentName: student.name,
      userId: student._id,
      village,
      category: "Undergraduate",
      course,
      subCategory: `${course} Sem ${rnd(1, 6)}`,
      percentage: pct(42, 96),
      examYear: String(pick([2023, 2024, 2025])),
      educationDetails: { collegeName: pick(COLLEGES), course, university: "HNGU Patan" },
      status: isApproved ? "approved" : pick(["pending", "under_review", "rejected"]),
      reviewedBy: isApproved ? teacher._id : null,
      reviewedAt: isApproved ? new Date(created.getTime() + rnd(1, 12) * 3600000) : null,
      reviewLock: { reviewerId: null, lockedAt: null, expiresAt: null },
      _createdAt: created,
    }));
  }

  // --- Postgraduate results ---
  for (let i = 0; i < 15; i++) {
    const student = pick(students);
    const teacher = pick(teachers);
    const village = student.nativeVillage || pick(VILLAGE_NAMES);
    const course = pick(PG_COURSES);
    const isApproved = Math.random() > 0.15;
    const created = daysAgo(60, 1);
    await createResult(makeResult({
      studentName: student.name,
      userId: student._id,
      village,
      category: "Postgraduate",
      course,
      subCategory: `${course} Sem ${rnd(1, 4)}`,
      percentage: pct(50, 97),
      examYear: String(pick([2023, 2024, 2025])),
      educationDetails: { collegeName: pick(COLLEGES), course, university: "HNGU Patan" },
      status: isApproved ? "approved" : pick(["pending", "under_review", "rejected"]),
      reviewedBy: isApproved ? teacher._id : null,
      reviewedAt: isApproved ? new Date(created.getTime() + rnd(2, 15) * 3600000) : null,
      reviewLock: { reviewerId: null, lockedAt: null, expiresAt: null },
      _createdAt: created,
    }));
  }

  // --- Government Exams results ---
  for (let i = 0; i < 20; i++) {
    const student = pick(students);
    const teacher = pick(teachers);
    const village = student.nativeVillage || pick(VILLAGE_NAMES);
    const exam = pick(GOVT_EXAMS);
    const isApproved = Math.random() > 0.2;
    const created = daysAgo(50, 1);
    await createResult(makeResult({
      studentName: student.name,
      userId: student._id,
      village,
      category: "Government Exams",
      subject: exam,
      subCategory: exam,
      percentage: pct(35, 90),
      grade: pick(["Pass", "Merit", "High Merit", "Outstanding"]),
      examYear: String(pick([2023, 2024, 2025])),
      educationDetails: { examName: exam, conductedBy: "GPSC / UPSC / SSC", result: "Pass" },
      status: isApproved ? "approved" : pick(["pending", "under_review", "rejected"]),
      reviewedBy: isApproved ? teacher._id : null,
      reviewedAt: isApproved ? new Date(created.getTime() + rnd(1, 24) * 3600000) : null,
      reviewLock: { reviewerId: null, lockedAt: null, expiresAt: null },
      _createdAt: created,
    }));
  }

  // --- Extra: results currently under_review with active lock ---
  for (let i = 0; i < 6; i++) {
    const student = pick(students);
    const teacher = pick(teachers);
    const lockedAt = daysAgo(0.1); // locked ~2.4 hrs ago
    await createResult(makeResult({
      studentName: student.name,
      userId: student._id,
      village: student.nativeVillage || pick(VILLAGE_NAMES),
      category: pick(CATEGORY_NAMES),
      percentage: pct(),
      examYear: "2025",
      educationDetails: { schoolName: pick(SCHOOLS) },
      status: "under_review",
      reviewedBy: teacher._id,
      reviewLock: {
        reviewerId: teacher._id,
        lockedAt,
        expiresAt: new Date(lockedAt.getTime() + 15 * 60000),
      },
      _createdAt: daysAgo(3),
    }));
  }

  // --- Extra: rejected results with reasons ---
  for (let i = 0; i < 8; i++) {
    const student = pick(students);
    const teacher = pick(teachers);
    const created = daysAgo(45, 5);
    await createResult(makeResult({
      studentName: student.name,
      userId: student._id,
      village: student.nativeVillage || pick(VILLAGE_NAMES),
      category: pick(CATEGORY_NAMES),
      percentage: pct(20, 40),
      examYear: "2024",
      educationDetails: { schoolName: pick(SCHOOLS) },
      status: "rejected",
      rejectionReason: pick([
        "Document not legible",
        "Marksheet appears tampered",
        "Missing institution seal",
        "Year mismatch in certificate",
        "Duplicate submission detected",
      ]),
      reviewedBy: teacher._id,
      reviewedAt: new Date(created.getTime() + rnd(1, 5) * 3600000),
      reviewComments: "Please resubmit with a clearer scan.",
      reviewLock: { reviewerId: null, lockedAt: null, expiresAt: null },
      _createdAt: created,
    }));
  }

  // --- Archived results ---
  for (let i = 0; i < 5; i++) {
    const student = pick(students);
    const created = daysAgo(88, 60);
    const r = await createResult(makeResult({
      studentName: student.name,
      userId: student._id,
      village: student.nativeVillage || pick(VILLAGE_NAMES),
      category: "1st-10th",
      percentage: pct(),
      examYear: "2022",
      educationDetails: { schoolName: pick(SCHOOLS) },
      status: "approved",
      reviewedBy: pick(teachers)._id,
      reviewedAt: new Date(created.getTime() + 3600000),
      archivedAt: daysAgo(30),
      archivedBy: admin._id,
      reviewLock: { reviewerId: null, lockedAt: null, expiresAt: null },
      _createdAt: created,
    }));
  }

  console.log(`   ✅ ${resultCount} results`);

  // ── 6. NOTIFICATIONS ───────────────────────────────────────────────────────
  console.log("🔔 Seeding notifications …");

  const notifDefs = [
    {
      title: "Result Portal Launch",
      message: "Welcome to the Student Result Portal! Upload your results and get them verified quickly.",
      type: "custom", priority: "high", audience: "all_students",
      createdBy: superAdmin._id, createdAt: daysAgo(85),
    },
    {
      title: "Submission Deadline Reminder",
      message: "Deadline to submit results for academic year 2024-25 is approaching. Please upload before 30th June.",
      type: "custom", priority: "high", audience: "all_students",
      createdBy: admin._id, createdAt: daysAgo(60),
    },
    {
      title: "Teacher Orientation Scheduled",
      message: "An online orientation for all teachers is scheduled on 15th June at 10 AM. Join via the shared link.",
      type: "custom", priority: "normal", audience: "all_teachers",
      createdBy: superAdmin._id, createdAt: daysAgo(55),
    },
    {
      title: "Anavada Village — Results Pending",
      message: "Students from Anavada village have pending results. Please review and verify at the earliest.",
      type: "auto", priority: "normal", audience: "village",
      metadata: { village: "Anavada", notificationType: "reminder" },
      createdBy: teachers[0]._id, createdAt: daysAgo(40),
    },
    {
      title: "Government Exam Results — Verification Open",
      message: "Result verification for Government Exam category is now open. Submit your documents.",
      type: "custom", priority: "high", audience: "category",
      metadata: { category: "Government Exams", notificationType: "important" },
      createdBy: teachers[2]._id, createdAt: daysAgo(35),
    },
    {
      title: "Congratulations — High Achievers!",
      message: "We congratulate all students who scored above 90%. Keep up the excellent work!",
      type: "custom", priority: "normal", audience: "all_students",
      createdBy: admin._id, createdAt: daysAgo(30),
    },
    {
      title: "System Maintenance Notice",
      message: "The portal will undergo scheduled maintenance on Sunday 2 AM – 4 AM. Please plan accordingly.",
      type: "auto", priority: "high", audience: "all_students",
      createdBy: superAdmin._id, createdAt: daysAgo(20),
    },
    {
      title: "New Upload Feature Available",
      message: "You can now upload multiple result documents in one submission. Check out the updated upload page.",
      type: "custom", priority: "normal", audience: "all_students",
      createdBy: superAdmin._id, createdAt: daysAgo(15),
    },
    {
      title: "Review Backlog Alert",
      message: "Over 20 results are awaiting review. Teachers, please clear the queue before end of week.",
      type: "auto", priority: "high", audience: "all_teachers",
      createdBy: admin._id, createdAt: daysAgo(10),
    },
    {
      title: "Bodana Village — Approval Update",
      message: "All submitted results from Bodana village have been reviewed and approved.",
      type: "auto", priority: "normal", audience: "village",
      metadata: { village: "Bodana", notificationType: "general" },
      createdBy: teachers[1]._id, createdAt: daysAgo(5),
    },
    {
      title: "Draft Notification (Not Sent)",
      message: "This is a draft notification that has not been published yet.",
      type: "custom", priority: "normal", audience: "all_students",
      metadata: { draft: true, notificationType: "general" },
      createdBy: admin._id, createdAt: daysAgo(2),
    },
    {
      title: "Postgraduate Deadline Extended",
      message: "The submission deadline for Postgraduate category has been extended by 7 days.",
      type: "custom", priority: "high", audience: "category",
      metadata: { category: "Postgraduate", notificationType: "urgent" },
      createdBy: superAdmin._id, createdAt: daysAgo(1),
    },
  ];

  for (const def of notifDefs) {
    const { createdAt: ca, ...rest } = def;
    const n = await Notification.create(rest);
    await Notification.collection.updateOne({ _id: n._id }, { $set: { createdAt: ca, updatedAt: ca } });
  }
  console.log(`   ✅ ${notifDefs.length} notifications`);

  // ── 7. AUDIT LOGS ──────────────────────────────────────────────────────────
  console.log("📋 Seeding audit logs …");

  const allResults = await Result.find({}).limit(20).lean();

  const auditDefs = [
    // Auth
    { userId: superAdmin._id, action: "login", module: "auth", ip: "192.168.1.1", createdAt: daysAgo(90) },
    { userId: admin._id, action: "login", module: "auth", ip: "10.0.0.5", createdAt: daysAgo(80) },
    { userId: teachers[0]._id, action: "login", module: "auth", ip: "172.16.0.10", createdAt: daysAgo(70) },
    // Users
    { userId: superAdmin._id, action: "create_teacher", module: "users", targetId: teachers[0]._id, ip: "192.168.1.1", createdAt: daysAgo(88) },
    { userId: superAdmin._id, action: "create_teacher", module: "users", targetId: teachers[1]._id, ip: "192.168.1.1", createdAt: daysAgo(87) },
    { userId: superAdmin._id, action: "create_teacher", module: "users", targetId: teachers[2]._id, ip: "192.168.1.1", createdAt: daysAgo(86) },
    { userId: admin._id, action: "update_user", module: "users", targetId: students[0]._id, ip: "10.0.0.5", metadata: { isActive: false }, createdAt: daysAgo(50) },
    { userId: admin._id, action: "reset_password", module: "users", targetId: teachers[3]._id, ip: "10.0.0.5", createdAt: daysAgo(45) },
    // Results
    ...allResults.slice(0, 10).map((r, i) => ({
      userId: pick(teachers)._id,
      action: pick(["approve_result", "reject_result", "update_result"]),
      module: "results",
      targetId: r._id,
      ip: "172.16.0.10",
      metadata: { status: r.status },
      createdAt: daysAgo(80 - i * 5),
    })),
    // Reviews
    ...allResults.slice(10, 16).map((r, i) => ({
      userId: pick(teachers)._id,
      action: "force_release_lock",
      module: "reviews",
      targetId: r._id,
      ip: "192.168.1.1",
      createdAt: daysAgo(30 - i * 4),
    })),
    // Notifications
    { userId: admin._id, action: "send_notification", module: "notifications", ip: "10.0.0.5", metadata: { audience: "all_students" }, createdAt: daysAgo(60) },
    { userId: superAdmin._id, action: "send_notification", module: "notifications", ip: "192.168.1.1", metadata: { audience: "all_teachers" }, createdAt: daysAgo(55) },
    // Villages
    { userId: superAdmin._id, action: "create_village", module: "villages", metadata: { name: "Anavada" }, ip: "192.168.1.1", createdAt: daysAgo(89) },
    { userId: superAdmin._id, action: "update_village", module: "villages", metadata: { status: "disabled" }, ip: "192.168.1.1", createdAt: daysAgo(20) },
    // Categories
    { userId: superAdmin._id, action: "create_category", module: "categories", metadata: { name: "Government Exams" }, ip: "192.168.1.1", createdAt: daysAgo(89) },
    // Institutions
    { userId: admin._id, action: "create_institution", module: "institutions", metadata: { name: "GPC Mehsana", type: "college" }, ip: "10.0.0.5", createdAt: daysAgo(85) },
    { userId: admin._id, action: "merge_institutions", module: "institutions", metadata: { merged: 2 }, ip: "10.0.0.5", createdAt: daysAgo(40) },
    // Storage
    { userId: superAdmin._id, action: "cleanup_storage", module: "storage", ip: "192.168.1.1", createdAt: daysAgo(15) },
    { userId: superAdmin._id, action: "sync_drive", module: "storage", ip: "192.168.1.1", createdAt: daysAgo(5) },
  ];

  for (const def of auditDefs) {
    const { createdAt: ca, userId, action, module: mod, targetId, ip, metadata } = def;
    const log = await AuditLog.create({
      userId: userId || null,
      action,
      module: mod,
      targetId: targetId ? String(targetId) : "",
      ip: ip || "",
      metadata: metadata || {},
    });
    await AuditLog.collection.updateOne({ _id: log._id }, { $set: { createdAt: ca, updatedAt: ca } });
  }
  console.log(`   ✅ ${auditDefs.length} audit log entries`);

  // ── summary ─────────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════");
  console.log("✅  Seed complete! Credentials summary:");
  console.log("════════════════════════════════════════════════════");
  console.log("SUPER ADMIN");
  console.log("  Email:    admin@resultportal.com");
  console.log("  Password: admin123");
  console.log("  Permissions: ALL\n");
  console.log("ADMIN");
  console.log("  Email:    ravi.admin@resultportal.com");
  console.log("  Password: admin123");
  console.log("  Permissions: manage_users, manage_results, manage_notifications,");
  console.log("               view_analytics, view_audit_logs\n");
  console.log("TEACHERS (all password: teacher123)");
  for (const t of teacherDefs) {
    console.log(`  ${t.email.padEnd(36)} → ${t.assignedCategories.join(", ")}`);
  }
  console.log("\nSTUDENTS (all password: student123)");
  console.log(`  ${studentDefs.length} students across ${VILLAGE_NAMES.length} villages`);
  console.log("  e.g. " + studentDefs[0].email);
  console.log("\n⚠️  Change all passwords before going to production!");
  console.log("════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
};

// ─── helpers ────────────────────────────────────────────────────────────────

async function upsertUser(data) {
  const existing = await User.findOne({ email: data.email });
  if (existing) return existing;
  return User.create(data);
}

async function upsertVillage(name, createdBy, status = "active") {
  return Village.findOneAndUpdate(
    { name },
    { name, status, createdBy },
    { upsert: true, new: true }
  );
}

async function upsertInstitution(name, type, createdBy) {
  const normalizedName = normalizeName(name);
  return Institution.findOneAndUpdate(
    { normalizedName, type },
    { name, normalizedName, type, status: "active", createdBy },
    { upsert: true, new: true }
  );
}

/** Generate realistic student definitions spread across villages */
function generateStudentDefs(villageNames, count) {
  const firstNames = [
    "Aarav", "Bhavya", "Chirag", "Dhruvi", "Esha", "Fenil", "Gargi",
    "Hardik", "Ishaan", "Jinal", "Krish", "Lakshmi", "Manav", "Nidhi",
    "Om", "Payal", "Raj", "Sita", "Tanvi", "Utsav", "Vini", "Yash",
    "Zeel", "Arjun", "Bhumi", "Chetna", "Disha", "Ekta", "Foram",
    "Gaurav", "Hetal", "Ishan", "Jyoti", "Kiran", "Lata", "Mohan",
  ];
  const lastNames = [
    "Patel", "Shah", "Mehta", "Desai", "Joshi", "Trivedi", "Pandya",
    "Bhatt", "Modi", "Amin", "Soni", "Nair", "Rao", "Sharma", "Verma",
  ];

  const defs = [];
  for (let i = 0; i < count; i++) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    const village = villageNames[i % villageNames.length];
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@student.com`;
    defs.push({
      name: `${first} ${last}`,
      email,
      village,
      nativeVillage: village,
      lastLoginAt: Math.random() > 0.3 ? daysAgo(30) : null,
    });
  }
  return defs;
}

// ─── run ────────────────────────────────────────────────────────────────────

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});