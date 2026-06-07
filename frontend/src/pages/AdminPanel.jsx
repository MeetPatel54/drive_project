import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import FileViewerModal from "../components/FileViewerModal";
import {
  CategoryScoreboard,
  CountListCard,
  DonutChart,
  HorizontalBarChart,
  MetricCard,
} from "../components/analytics";
import {
  EmptyState,
  ErrorMessage,
  PageLoader,
  StatCard,
  StatusBadge,
  SuccessMessage,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useFileViewer } from "../hooks/useFileViewer";
import { exportSectionsToExcel, printSectionsAsPdf } from "../utils/exportUtils";
import {
  formatResultDate,
  formatResultLevel,
  formatResultScore,
  getScoreColor,
  resultExportColumns,
  resultToExportRow,
} from "../utils/resultFormatters";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users", permission: "manage_users" },
  { id: "results", label: "Results", permission: "manage_results" },
  { id: "reviews", label: "Reviews", permission: "manage_results" },
  { id: "notifications", label: "Notifications", permission: "manage_notifications" },
  { id: "master", label: "Master Data", permission: "manage_villages" },
  { id: "analytics", label: "Analytics", permission: "view_analytics" },
  { id: "system", label: "System", permission: "view_system_health" },
];

const emptyBootstrap = {
  dashboard: {},
  analytics: {
    villageAnalytics: [],
    teacherAnalytics: [],
    institutionAnalytics: [],
    categoryAnalytics: [],
  },
  villages: [],
  categories: [],
  institutions: [],
  notifications: [],
  reviewMonitoring: { lockedResults: [], teacherStats: [] },
  storage: {
    totalFiles: 0,
    storageUsed: 0,
    remainingStorage: 0,
    largestFiles: [],
    recentUploads: [],
    failedUploads: 0,
  },
  moderation: [],
  auditLogs: { data: [] },
  systemHealth: {},
  permissions: [],
};

const emptyUsersState = { data: [], total: 0, page: 1, totalPages: 1 };
const emptyResultsState = { data: [], total: 0, page: 1, totalPages: 1 };
const emptyAuditState = { data: [], total: 0, page: 1, totalPages: 1 };

const formatBytes = (bytes) => {
  if (!bytes) return "0 MB";
  const value = bytes / 1024 / 1024;
  return `${value.toFixed(value >= 100 ? 0 : 1)} MB`;
};

const toCsvList = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const AdminPanel = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [bootstrap, setBootstrap] = useState(emptyBootstrap);
  const [usersState, setUsersState] = useState(emptyUsersState);
  const [resultsState, setResultsState] = useState(emptyResultsState);
  const [auditState, setAuditState] = useState(emptyAuditState);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [sectionLoading, setSectionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userFilters, setUserFilters] = useState({
    role: "",
    search: "",
    village: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [resultFilters, setResultFilters] = useState({
    status: "",
    category: "",
    village: "",
    teacher: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  });
  const [auditFilters, setAuditFilters] = useState({ search: "", module: "" });
  const [teacherForm, setTeacherForm] = useState({
    name: "",
    email: "",
    password: "",
    assignedVillages: "",
    assignedCategories: "",
  });
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    audience: "all_students",
    notificationType: "general",
    village: "",
    category: "",
    selectedUsers: "",
    scheduledAt: "",
    draft: false,
  });
  const [newVillage, setNewVillage] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newInstitution, setNewInstitution] = useState({ name: "", type: "school" });
  const [mergeForm, setMergeForm] = useState({ primaryId: "", duplicateId: "" });
  const [reviewAssignments, setReviewAssignments] = useState({});
  const { fileViewer, openFileViewer, closeFileViewer } = useFileViewer();

  const can = useCallback(
    (permission) =>
      user?.role === "super_admin" ||
      !permission ||
      (Array.isArray(user?.permissions) && user.permissions.includes(permission)),
    [user]
  );

  const availableTabs = useMemo(
    () => tabs.filter((tab) => can(tab.permission)),
    [can]
  );

  const currentTeachers = useMemo(
    () => usersState.data.filter((entry) => entry.role === "teacher"),
    [usersState.data]
  );

  const reviewStatsByTeacher = useMemo(
    () =>
      new Map(
        (bootstrap.reviewMonitoring.teacherStats || []).map((item) => [item.reviewerName, item])
      ),
    [bootstrap.reviewMonitoring.teacherStats]
  );

  const flash = useCallback((text) => {
    setMessage(text);
    window.clearTimeout(window.__adminFlashTimer);
    window.__adminFlashTimer = window.setTimeout(() => setMessage(""), 3500);
  }, []);

  const runTask = useCallback(
    async (task, options = {}) => {
      const { successMessage = "", loadingKey = "" } = options;
      setError("");
      if (loadingKey) setSectionLoading(loadingKey);
      try {
        const result = await task();
        if (successMessage) flash(successMessage);
        return result;
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || "Something went wrong.");
        throw err;
      } finally {
        if (loadingKey) setSectionLoading("");
      }
    },
    [flash]
  );

  const fetchBootstrap = useCallback(async () => {
    setLoadingBootstrap(true);
    setError("");
    try {
      const res = await api.get("/admin/bootstrap");
      setBootstrap(res.data.data || emptyBootstrap);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Could not load admin data.");
    } finally {
      setLoadingBootstrap(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!can("manage_users")) return;
    const params = Object.fromEntries(
      Object.entries(userFilters).filter(([, value]) => value)
    );
    const res = await api.get("/admin/users", { params: { ...params, limit: 100 } });
    setUsersState({
      data: res.data.data || [],
      total: res.data.total || 0,
      page: res.data.page || 1,
      totalPages: res.data.totalPages || 1,
    });
  }, [can, userFilters]);

  const fetchResults = useCallback(async () => {
    if (!can("manage_results")) return;
    const params = Object.fromEntries(
      Object.entries(resultFilters).filter(([, value]) => value)
    );
    const res = await api.get("/admin/results", { params: { ...params, limit: 100 } });
    setResultsState({
      data: res.data.data || [],
      total: res.data.total || 0,
      page: res.data.page || 1,
      totalPages: res.data.totalPages || 1,
    });
  }, [can, resultFilters]);

  const fetchAuditLogs = useCallback(async () => {
    if (!can("view_audit_logs")) return;
    const params = Object.fromEntries(
      Object.entries(auditFilters).filter(([, value]) => value)
    );
    const res = await api.get("/admin/audit-logs", { params: { ...params, limit: 100 } });
    setAuditState({
      data: res.data.data || [],
      total: res.data.total || 0,
      page: res.data.page || 1,
      totalPages: res.data.totalPages || 1,
    });
  }, [auditFilters, can]);

  const refreshBootstrap = useCallback(
    () => runTask(fetchBootstrap, { loadingKey: "bootstrap" }),
    [fetchBootstrap, runTask]
  );

  const refreshAll = useCallback(async () => {
    const jobs = [fetchBootstrap()];
    if (can("manage_users")) jobs.push(fetchUsers());
    if (can("manage_results")) jobs.push(fetchResults());
    if (can("view_audit_logs")) jobs.push(fetchAuditLogs());
    await Promise.all(jobs);
  }, [can, fetchAuditLogs, fetchBootstrap, fetchResults, fetchUsers]);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  useEffect(() => {
    if (can("manage_users")) fetchUsers().catch(() => {});
    if (can("manage_results")) fetchResults().catch(() => {});
    if (can("view_audit_logs")) fetchAuditLogs().catch(() => {});
  }, [can, fetchAuditLogs, fetchResults, fetchUsers]);

  useEffect(() => {
    if (!availableTabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(availableTabs[0]?.id || "overview");
    }
  }, [activeTab, availableTabs]);

  useEffect(
    () => () => {
      if (window.__adminFlashTimer) {
        window.clearTimeout(window.__adminFlashTimer);
      }
    },
    []
  );

  const teacherAnalytics = bootstrap.analytics.teacherAnalytics || [];
  const results = resultsState.data || [];
  const reviewLocks = bootstrap.reviewMonitoring.lockedResults || [];

  const categoryScoreboards = useMemo(() => {
    const grouped = new Map();
    results.forEach((result) => {
      const label = result.subCategory === "Diploma" ? "Diploma" : result.category || "Other";
      const bucket = grouped.get(label) || [];
      bucket.push(result);
      grouped.set(label, bucket);
    });

    return [...grouped.entries()].map(([label, entries]) => ({
      label,
      students: [...entries]
        .sort((left, right) => (right.percentage || 0) - (left.percentage || 0))
        .slice(0, 5)
        .map((entry) => ({ ...entry, result: entry })),
    }));
  }, [results]);

  const exportDashboard = () =>
    printSectionsAsPdf({
      title: "Admin Dashboard Summary",
      sections: [
        {
          title: "Overview",
          columns: [
            { key: "metric", label: "Metric" },
            { key: "value", label: "Value" },
          ],
          rows: Object.entries(bootstrap.dashboard || {}).map(([metric, value]) => ({ metric, value })),
        },
      ],
    });

  const exportUsers = () =>
    exportSectionsToExcel({
      title: "Admin Users",
      fileName: "admin-users",
      sections: [
        {
          title: "Users",
          columns: [
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "village", label: "Village" },
            { key: "status", label: "Status" },
            { key: "assignedVillages", label: "Assigned Villages" },
            { key: "assignedCategories", label: "Assigned Categories" },
          ],
          rows: usersState.data.map((entry) => ({
            name: entry.name,
            email: entry.email,
            role: entry.role,
            village: entry.nativeVillage || entry.village || "-",
            status: entry.isActive ? "active" : "disabled",
            assignedVillages: (entry.assignedVillages || []).join(", ") || "-",
            assignedCategories: (entry.assignedCategories || []).join(", ") || "-",
          })),
        },
      ],
    });

  const exportResults = () =>
    exportSectionsToExcel({
      title: "Admin Results",
      fileName: "admin-results",
      sections: [{ title: "Results", columns: resultExportColumns, rows: results.map(resultToExportRow) }],
    });

  const exportAuditLogs = () =>
    exportSectionsToExcel({
      title: "Audit Logs",
      fileName: "audit-logs",
      sections: [
        {
          title: "Logs",
          columns: [
            { key: "action", label: "Action" },
            { key: "module", label: "Module" },
            { key: "user", label: "User" },
            { key: "targetId", label: "Target" },
            { key: "createdAt", label: "Date" },
          ],
          rows: auditState.data.map((log) => ({
            action: log.action,
            module: log.module,
            user: log.userId?.name || "System",
            targetId: log.targetId || "-",
            createdAt: formatResultDate(log.createdAt),
          })),
        },
      ],
    });

  const submitTeacher = async (event) => {
    event.preventDefault();
    await runTask(
      async () => {
        await api.post("/admin/users/teachers", {
          ...teacherForm,
          assignedVillages: toCsvList(teacherForm.assignedVillages),
          assignedCategories: toCsvList(teacherForm.assignedCategories),
          permissions: ["view_analytics"],
        });
        setTeacherForm({
          name: "",
          email: "",
          password: "",
          assignedVillages: "",
          assignedCategories: "",
        });
        await Promise.all([fetchUsers(), fetchBootstrap()]);
      },
      { successMessage: "Teacher created.", loadingKey: "teacher-create" }
    );
  };

  const updateUserStatus = async (entry) => {
    await runTask(
      async () => {
        await api.patch(`/admin/users/${entry._id}`, {
          ...entry,
          isActive: !entry.isActive,
          permissions: entry.permissions || [],
          assignedCategories: entry.assignedCategories || [],
          assignedVillages: entry.assignedVillages || [],
          nativeVillage: entry.nativeVillage || "",
        });
        await Promise.all([fetchUsers(), fetchBootstrap()]);
      },
      {
        successMessage: `${entry.name} ${entry.isActive ? "disabled" : "enabled"}.`,
        loadingKey: `user-${entry._id}`,
      }
    );
  };

  const resetPassword = async (entry) => {
    const password = window.prompt(`Set a new password for ${entry.name}`, "password123");
    if (!password) return;

    await runTask(
      () => api.patch(`/admin/users/${entry._id}/reset-password`, { password }),
      { successMessage: "Password reset.", loadingKey: `reset-${entry._id}` }
    );
  };

  const patchResult = async (id, patch, successMessage) => {
    await runTask(
      async () => {
        await api.patch(`/admin/results/${id}`, patch);
        await Promise.all([fetchResults(), fetchBootstrap()]);
      },
      { successMessage, loadingKey: `result-${id}` }
    );
  };

  const forceReleaseLock = async (id) => {
    await runTask(
      async () => {
        await api.post(`/admin/reviews/${id}/force-release`);
        await fetchBootstrap();
      },
      { successMessage: "Review lock released.", loadingKey: `lock-${id}` }
    );
  };

  const reassignReview = async (id) => {
    const reviewerId = reviewAssignments[id];
    if (!reviewerId) {
      setError("Please choose a reviewer before reassigning.");
      return;
    }

    await runTask(
      async () => {
        await api.post(`/admin/reviews/${id}/reassign`, { reviewerId });
        await fetchBootstrap();
      },
      { successMessage: "Review reassigned.", loadingKey: `reassign-${id}` }
    );
  };

  const sendNotification = async (event) => {
    event.preventDefault();
    await runTask(
      async () => {
        await api.post("/admin/notifications", {
          ...notificationForm,
          selectedUsers: toCsvList(notificationForm.selectedUsers),
        });
        setNotificationForm({
          title: "",
          message: "",
          audience: "all_students",
          notificationType: "general",
          village: "",
          category: "",
          selectedUsers: "",
          scheduledAt: "",
          draft: false,
        });
        await fetchBootstrap();
      },
      { successMessage: "Notification saved.", loadingKey: "notification-create" }
    );
  };

  const resendNotification = async (id) => {
    await runTask(
      async () => {
        await api.post(`/admin/notifications/${id}/resend`);
        await fetchBootstrap();
      },
      { successMessage: "Notification resent.", loadingKey: `notification-${id}` }
    );
  };

  const createVillage = async (event) => {
    event.preventDefault();
    await runTask(
      async () => {
        await api.post("/admin/villages", { name: newVillage });
        setNewVillage("");
        await fetchBootstrap();
      },
      { successMessage: "Village created.", loadingKey: "village-create" }
    );
  };

  const createCategory = async (event) => {
    event.preventDefault();
    await runTask(
      async () => {
        await api.post("/admin/categories", { name: newCategory });
        setNewCategory("");
        await fetchBootstrap();
      },
      { successMessage: "Category created.", loadingKey: "category-create" }
    );
  };

  const createInstitution = async (event) => {
    event.preventDefault();
    await runTask(
      async () => {
        await api.post("/admin/institutions", newInstitution);
        setNewInstitution({ name: "", type: "school" });
        await fetchBootstrap();
      },
      { successMessage: "Institution created.", loadingKey: "institution-create" }
    );
  };

  const patchVillage = async (id, patch) => {
    await runTask(
      async () => {
        await api.patch(`/admin/villages/${id}`, patch);
        await fetchBootstrap();
      },
      { successMessage: "Village updated.", loadingKey: `village-${id}` }
    );
  };

  const patchCategory = async (id, patch) => {
    await runTask(
      async () => {
        await api.patch(`/admin/categories/${id}`, patch);
        await fetchBootstrap();
      },
      { successMessage: "Category updated.", loadingKey: `category-${id}` }
    );
  };

  const patchInstitution = async (id, patch) => {
    await runTask(
      async () => {
        await api.patch(`/admin/institutions/${id}`, patch);
        await fetchBootstrap();
      },
      { successMessage: "Institution updated.", loadingKey: `institution-${id}` }
    );
  };

  const mergeInstitutions = async (event) => {
    event.preventDefault();
    if (!mergeForm.primaryId || !mergeForm.duplicateId || mergeForm.primaryId === mergeForm.duplicateId) {
      setError("Choose a primary institution and a different duplicate to merge.");
      return;
    }

    await runTask(
      async () => {
        await api.post("/admin/institutions/merge", {
          primaryId: mergeForm.primaryId,
          duplicateIds: [mergeForm.duplicateId],
        });
        setMergeForm({ primaryId: "", duplicateId: "" });
        await fetchBootstrap();
      },
      { successMessage: "Institution merged.", loadingKey: "institution-merge" }
    );
  };

  const resolveModeration = async (resultId, status) => {
    await runTask(
      async () => {
        await api.patch(`/admin/moderation/${resultId}`, { status });
        await fetchBootstrap();
      },
      { successMessage: "Moderation item updated.", loadingKey: `moderation-${resultId}` }
    );
  };

  const runStorageAction = async (action, needsConfirmation = false) => {
    if (
      needsConfirmation &&
      !window.confirm("This action can affect stored files. Please confirm you want to continue.")
    ) {
      return;
    }

    await runTask(
      async () => {
        await api.post(`/admin/storage/${action}`);
        await fetchBootstrap();
      },
      { successMessage: `${action.replace(/-/g, " ")} completed.`, loadingKey: `storage-${action}` }
    );
  };

  const backupExports = [
    {
      label: "Students",
      fileName: "students-backup",
      rows: usersState.data.filter((entry) => entry.role === "student").map((entry) => ({
        name: entry.name,
        email: entry.email,
        village: entry.nativeVillage || "-",
        status: entry.isActive ? "active" : "disabled",
      })),
      columns: [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "village", label: "Village" },
        { key: "status", label: "Status" },
      ],
    },
    {
      label: "Results",
      fileName: "results-backup",
      rows: results.map(resultToExportRow),
      columns: resultExportColumns,
    },
    {
      label: "Analytics",
      fileName: "analytics-backup",
      rows: (bootstrap.analytics.villageAnalytics || []).map((item) => ({
        village: item.label,
        studentCount: item.studentCount,
        avgPerformance: item.avgPerformance,
      })),
      columns: [
        { key: "village", label: "Village" },
        { key: "studentCount", label: "Students" },
        { key: "avgPerformance", label: "Avg Performance" },
      ],
    },
    {
      label: "Audit Logs",
      fileName: "audit-backup",
      rows: auditState.data.map((entry) => ({
        action: entry.action,
        module: entry.module,
        user: entry.userId?.name || "System",
        date: formatResultDate(entry.createdAt),
      })),
      columns: [
        { key: "action", label: "Action" },
        { key: "module", label: "Module" },
        { key: "user", label: "User" },
        { key: "date", label: "Date" },
      ],
    },
    {
      label: "Notifications",
      fileName: "notifications-backup",
      rows: (bootstrap.notifications || []).map((entry) => ({
        title: entry.title,
        audience: entry.audience,
        type: entry.type,
        priority: entry.priority,
        createdAt: formatResultDate(entry.createdAt),
      })),
      columns: [
        { key: "title", label: "Title" },
        { key: "audience", label: "Audience" },
        { key: "type", label: "Type" },
        { key: "priority", label: "Priority" },
        { key: "createdAt", label: "Created" },
      ],
    },
  ];

  if (loadingBootstrap) return <PageLoader />;

  const dashboard = bootstrap.dashboard || {};
  const overviewStatusData = [
    { label: "Pending", count: dashboard.pendingReviews || 0, percentage: dashboard.totalResults ? Math.round(((dashboard.pendingReviews || 0) / dashboard.totalResults) * 100) : 0 },
    { label: "Under Review", count: dashboard.underReview || 0, percentage: dashboard.totalResults ? Math.round(((dashboard.underReview || 0) / dashboard.totalResults) * 100) : 0 },
    { label: "Approved", count: dashboard.approvedResults || 0, percentage: dashboard.totalResults ? Math.round(((dashboard.approvedResults || 0) / dashboard.totalResults) * 100) : 0 },
    { label: "Rejected", count: dashboard.rejectedResults || 0, percentage: dashboard.totalResults ? Math.round(((dashboard.rejectedResults || 0) / dashboard.totalResults) * 100) : 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Admin Panel</h1>
          <p className="mt-1 text-sm text-gray-500">
            Platform operations, oversight, analytics, and moderation without leaving the existing system.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={refreshAll} disabled={sectionLoading === "bootstrap"}>
            {sectionLoading === "bootstrap" ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={exportDashboard}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <SuccessMessage message={message} />
        <ErrorMessage message={error} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
            <MetricCard label="Students" value={dashboard.totalStudents || 0} helper="Registered students" tone="indigo" />
            <MetricCard label="Teachers" value={dashboard.totalTeachers || 0} helper="Teachers and admins" tone="cyan" />
            <MetricCard label="Results" value={dashboard.totalResults || 0} helper="All submissions" tone="slate" />
            <MetricCard label="Pending" value={dashboard.pendingReviews || 0} helper="Awaiting review" tone="amber" />
            <MetricCard label="Under Review" value={dashboard.underReview || 0} helper="Actively locked" tone="indigo" />
            <MetricCard label="Approved" value={dashboard.approvedResults || 0} helper="Completed reviews" tone="emerald" />
            <MetricCard label="Rejected" value={dashboard.rejectedResults || 0} helper="Needs correction" tone="red" />
            <MetricCard label="Villages" value={dashboard.totalVillages || 0} helper="Configured villages" tone="slate" />
            <MetricCard label="Schools" value={dashboard.totalSchools || 0} helper="Approved schools" tone="cyan" />
            <MetricCard label="Colleges" value={dashboard.totalColleges || 0} helper="Approved colleges" tone="cyan" />
            <MetricCard label="Storage Used" value={formatBytes(dashboard.storageUsed || 0)} helper="Tracked Drive usage" tone="amber" />
            <MetricCard label="Active Today" value={dashboard.activeUsersToday || 0} helper="Users active today" tone="emerald" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <HorizontalBarChart
              title="Village Performance"
              subtitle="Average performance by village"
              data={(bootstrap.analytics.villageAnalytics || []).map((item) => ({
                label: item.label,
                avgScore: item.avgPerformance,
                count: item.studentCount,
              }))}
            />
            <DonutChart
              title="Review Status Mix"
              subtitle="Overall result workflow distribution"
              data={overviewStatusData}
              centerLabel="Results"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <HorizontalBarChart
              title="Teacher Review Performance"
              subtitle="Approval rate and workload"
              data={teacherAnalytics.map((item) => ({
                label: item.label,
                avgScore: item.approvalRate,
                count: item.reviewCount,
              }))}
            />
            <HorizontalBarChart
              title="Institution Performance"
              subtitle="Top schools and colleges"
              data={(bootstrap.analytics.institutionAnalytics || [])
                .slice(0, 10)
                .map((item) => ({ label: `${item.label} (${item.type})`, avgScore: item.avgPerformance, count: item.count }))}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <DonutChart
              title="Category Distribution"
              subtitle="Student result mix across education levels"
              data={(bootstrap.analytics.categoryAnalytics || []).map((item) => ({
                label: item.label,
                count: item.count,
                percentage: dashboard.totalResults ? Math.round((item.count / dashboard.totalResults) * 100) : 0,
              }))}
              centerLabel="Results"
            />
            <CountListCard
              title="Recent Notifications"
              subtitle="Latest platform-wide messages"
              data={(bootstrap.notifications || []).slice(0, 8).map((item) => ({
                label: `${item.title} (${item.audience})`,
                count: item.priority === "high" ? 2 : 1,
              }))}
              emptyText="No notifications sent yet."
            />
          </div>

          <CategoryScoreboard
            scoreboards={categoryScoreboards}
            onView={openFileViewer}
            formatScore={formatResultScore}
          />
        </div>
      )}

      {activeTab === "users" && can("manage_users") && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Loaded Users" value={usersState.total} icon="US" color="indigo" />
            <StatCard label="Students" value={usersState.data.filter((entry) => entry.role === "student").length} icon="ST" color="emerald" />
            <StatCard label="Teachers" value={currentTeachers.length} icon="TC" color="amber" />
            <StatCard label="Disabled" value={usersState.data.filter((entry) => !entry.isActive).length} icon="DS" color="red" />
          </div>

          <div className="card p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <input className="input" placeholder="Search users" value={userFilters.search} onChange={(e) => setUserFilters((current) => ({ ...current, search: e.target.value }))} />
              <select className="input" value={userFilters.role} onChange={(e) => setUserFilters((current) => ({ ...current, role: e.target.value }))}>
                <option value="">All roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="admin">Admins</option>
                <option value="super_admin">Super Admins</option>
              </select>
              <select className="input" value={userFilters.village} onChange={(e) => setUserFilters((current) => ({ ...current, village: e.target.value }))}>
                <option value="">All villages</option>
                {bootstrap.villages.map((village) => (
                  <option key={village._id} value={village.name}>{village.name}</option>
                ))}
              </select>
              <select className="input" value={userFilters.status} onChange={(e) => setUserFilters((current) => ({ ...current, status: e.target.value }))}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
              <input className="input" type="date" value={userFilters.dateFrom} onChange={(e) => setUserFilters((current) => ({ ...current, dateFrom: e.target.value }))} />
              <input className="input" type="date" value={userFilters.dateTo} onChange={(e) => setUserFilters((current) => ({ ...current, dateTo: e.target.value }))} />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setUserFilters({ role: "", search: "", village: "", status: "", dateFrom: "", dateTo: "" })}>
                Clear
              </button>
              <button type="button" className="btn-primary btn-sm" onClick={() => runTask(fetchUsers, { loadingKey: "users-fetch" })}>
                {sectionLoading === "users-fetch" ? "Applying..." : "Apply Filters"}
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={exportUsers}>
                Export Users
              </button>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-950">Teacher Management</h2>
              <p className="mt-1 text-sm text-gray-500">Create teachers and assign operational scope without touching the teacher dashboard.</p>
            </div>
            <form onSubmit={submitTeacher} className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <input className="input" placeholder="Teacher name" value={teacherForm.name} onChange={(e) => setTeacherForm((current) => ({ ...current, name: e.target.value }))} />
              <input className="input" placeholder="Teacher email" value={teacherForm.email} onChange={(e) => setTeacherForm((current) => ({ ...current, email: e.target.value }))} />
              <input className="input" placeholder="Password" value={teacherForm.password} onChange={(e) => setTeacherForm((current) => ({ ...current, password: e.target.value }))} />
              <input className="input" placeholder="Assigned villages (comma separated)" value={teacherForm.assignedVillages} onChange={(e) => setTeacherForm((current) => ({ ...current, assignedVillages: e.target.value }))} />
              <input className="input" placeholder="Assigned categories (comma separated)" value={teacherForm.assignedCategories} onChange={(e) => setTeacherForm((current) => ({ ...current, assignedCategories: e.target.value }))} />
              <button type="submit" className="btn-primary md:col-span-5" disabled={sectionLoading === "teacher-create"}>
                {sectionLoading === "teacher-create" ? "Creating..." : "Add Teacher"}
              </button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-gray-950">User Directory</h2>
                <p className="mt-1 text-xs text-gray-500">Searchable across students, teachers, and admins.</p>
              </div>
              <span className="text-sm text-gray-500">{usersState.total} users</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    {["Name", "Email", "Role", "Village", "Assignments", "Status", "Last Login", "Actions"].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usersState.data.map((entry) => (
                    <tr key={entry._id}>
                      <td className="px-4 py-3 font-medium text-gray-950">{entry.name}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.email}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.role}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.nativeVillage || entry.village || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="space-y-1">
                          <div>Villages: {(entry.assignedVillages || []).join(", ") || "-"}</div>
                          <div>Categories: {(entry.assignedCategories || []).join(", ") || "-"}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={entry.isActive ? "badge-approved" : "badge-rejected"}>
                          {entry.isActive ? "active" : "disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatResultDate(entry.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => updateUserStatus(entry)} disabled={sectionLoading === `user-${entry._id}`}>
                            {entry.isActive ? "Disable" : "Enable"}
                          </button>
                          <button type="button" className="btn-secondary btn-sm" onClick={() => resetPassword(entry)} disabled={sectionLoading === `reset-${entry._id}`}>
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {usersState.data.length === 0 && (
              <EmptyState icon="👥" title="No users found" description="Try a broader filter set." />
            )}
          </div>
        </div>
      )}

      {activeTab === "results" && can("manage_results") && (
        <div className="mt-6 space-y-6">
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
              <input className="input" placeholder="Search results" value={resultFilters.search} onChange={(e) => setResultFilters((current) => ({ ...current, search: e.target.value }))} />
              <select className="input" value={resultFilters.status} onChange={(e) => setResultFilters((current) => ({ ...current, status: e.target.value }))}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select className="input" value={resultFilters.category} onChange={(e) => setResultFilters((current) => ({ ...current, category: e.target.value }))}>
                <option value="">All categories</option>
                {bootstrap.categories.map((category) => (
                  <option key={category._id} value={category.name}>{category.name}</option>
                ))}
              </select>
              <select className="input" value={resultFilters.village} onChange={(e) => setResultFilters((current) => ({ ...current, village: e.target.value }))}>
                <option value="">All villages</option>
                {bootstrap.villages.map((village) => (
                  <option key={village._id} value={village.name}>{village.name}</option>
                ))}
              </select>
              <select className="input" value={resultFilters.teacher} onChange={(e) => setResultFilters((current) => ({ ...current, teacher: e.target.value }))}>
                <option value="">All reviewers</option>
                {currentTeachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>{teacher.name}</option>
                ))}
              </select>
              <input className="input" type="date" value={resultFilters.dateFrom} onChange={(e) => setResultFilters((current) => ({ ...current, dateFrom: e.target.value }))} />
              <input className="input" type="date" value={resultFilters.dateTo} onChange={(e) => setResultFilters((current) => ({ ...current, dateTo: e.target.value }))} />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setResultFilters({ status: "", category: "", village: "", teacher: "", search: "", dateFrom: "", dateTo: "" })}>
                Clear
              </button>
              <button type="button" className="btn-primary btn-sm" onClick={() => runTask(fetchResults, { loadingKey: "results-fetch" })}>
                {sectionLoading === "results-fetch" ? "Applying..." : "Apply Filters"}
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={exportResults}>
                Export Results
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-gray-950">Result Management</h2>
                <p className="mt-1 text-xs text-gray-500">Force review outcomes, archive soft-deleted items, and inspect files securely.</p>
              </div>
              <span className="text-sm text-gray-500">{resultsState.total} results</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    {["Student", "Village", "Category", "Level", "Score", "Status", "Submitted", "Reviewer", "Actions"].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((result) => (
                    <tr key={result._id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-950">{result.studentName}</div>
                        <div className="text-xs text-gray-400">
                          {result.deletedAt ? "Deleted" : result.archivedAt ? "Archived" : "Active"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{result.village || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{result.category || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{formatResultLevel(result)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${getScoreColor(result.percentage)}`}>{formatResultScore(result)}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={result.status} /></td>
                      <td className="px-4 py-3 text-gray-600">{formatResultDate(result.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-600">{result.reviewedBy?.name || result.reviewLock?.reviewerId?.name || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => openFileViewer(result)}>
                            View
                          </button>
                          <button type="button" className="btn-success btn-sm" onClick={() => patchResult(result._id, { status: "approved" }, "Result approved.")}>
                            Force Approve
                          </button>
                          <button type="button" className="btn-danger btn-sm" onClick={() => patchResult(result._id, { status: "rejected" }, "Result rejected.")}>
                            Force Reject
                          </button>
                          {!result.archivedAt ? (
                            <button type="button" className="btn-secondary btn-sm" onClick={() => patchResult(result._id, { archive: true }, "Result archived.")}>
                              Archive
                            </button>
                          ) : (
                            <button type="button" className="btn-secondary btn-sm" onClick={() => patchResult(result._id, { archive: false }, "Result restored from archive.")}>
                              Unarchive
                            </button>
                          )}
                          {!result.deletedAt ? (
                            <button type="button" className="btn-danger btn-sm" onClick={() => patchResult(result._id, { delete: true }, "Result deleted.")}>
                              Delete
                            </button>
                          ) : (
                            <button type="button" className="btn-secondary btn-sm" onClick={() => patchResult(result._id, { restore: true }, "Result restored.")}>
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {results.length === 0 && (
              <EmptyState icon="📄" title="No results found" description="Try adjusting the admin result filters." />
            )}
          </div>
        </div>
      )}

      {activeTab === "reviews" && can("manage_results") && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Locked Results" value={reviewLocks.length} icon="LK" color="indigo" />
            <StatCard label="Pending Reviews" value={dashboard.pendingReviews || 0} icon="PD" color="amber" />
            <StatCard label="Under Review" value={dashboard.underReview || 0} icon="RV" color="indigo" />
            <StatCard label="Approved" value={dashboard.approvedResults || 0} icon="AP" color="emerald" />
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-semibold text-gray-950">Live Review Locks</h2>
              <p className="mt-1 text-xs text-gray-500">Force release or reassign only when a review is genuinely blocked.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    {["Student", "Reviewer", "Locked At", "Expires", "Reassign", "Actions"].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reviewLocks.map((item) => (
                    <tr key={item._id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-950">{item.studentName}</div>
                        <div className="text-xs text-gray-400">{item.category || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.reviewLock?.reviewerId?.name || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{formatResultDate(item.reviewLock?.lockedAt)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatResultDate(item.reviewLock?.expiresAt)}</td>
                      <td className="px-4 py-3">
                        <select
                          className="input min-w-[180px]"
                          value={reviewAssignments[item._id] || ""}
                          onChange={(e) => setReviewAssignments((current) => ({ ...current, [item._id]: e.target.value }))}
                        >
                          <option value="">Select reviewer</option>
                          {currentTeachers.map((teacher) => (
                            <option key={teacher._id} value={teacher._id}>{teacher.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => reassignReview(item._id)} disabled={sectionLoading === `reassign-${item._id}`}>
                            Reassign
                          </button>
                          <button type="button" className="btn-danger btn-sm" onClick={() => forceReleaseLock(item._id)} disabled={sectionLoading === `lock-${item._id}`}>
                            Force Release
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reviewLocks.length === 0 && (
              <EmptyState icon="🔎" title="No active review locks" description="Results are either pending, completed, or already cleaned up." />
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-semibold text-gray-950">Reviewer Statistics</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    {["Reviewer", "Locked Results", "Pending Reviews", "Approved", "Rejected", "Avg Review Time"].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {teacherAnalytics.map((item) => {
                    const liveStats = reviewStatsByTeacher.get(item.label);
                    return (
                      <tr key={item.label}>
                        <td className="px-4 py-3 font-medium text-gray-950">{item.label}</td>
                        <td className="px-4 py-3 text-gray-600">{reviewLocks.filter((lock) => lock.reviewLock?.reviewerId?.name === item.label).length}</td>
                        <td className="px-4 py-3 text-gray-600">{liveStats?.pendingReviews || 0}</td>
                        <td className="px-4 py-3 text-gray-600">{liveStats?.approvedCount || 0}</td>
                        <td className="px-4 py-3 text-gray-600">{liveStats?.rejectedCount || 0}</td>
                        <td className="px-4 py-3 text-gray-600">{item.avgReviewTimeMinutes ? `${item.avgReviewTimeMinutes} min` : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "notifications" && can("manage_notifications") && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-950">Notification Center</h2>
              <p className="mt-1 text-sm text-gray-500">Send custom broadcasts, targeted announcements, or save drafts for later.</p>
            </div>
            <form onSubmit={sendNotification} className="space-y-3">
              <input className="input" placeholder="Title" value={notificationForm.title} onChange={(e) => setNotificationForm((current) => ({ ...current, title: e.target.value }))} />
              <textarea className="input min-h-[130px] resize-y" placeholder="Message" value={notificationForm.message} onChange={(e) => setNotificationForm((current) => ({ ...current, message: e.target.value }))} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select className="input" value={notificationForm.audience} onChange={(e) => setNotificationForm((current) => ({ ...current, audience: e.target.value }))}>
                  <option value="all_students">All Students</option>
                  <option value="all_teachers">All Teachers</option>
                  <option value="village">Village</option>
                  <option value="category">Category</option>
                  <option value="selected_users">Selected Users</option>
                </select>
                <select className="input" value={notificationForm.notificationType} onChange={(e) => setNotificationForm((current) => ({ ...current, notificationType: e.target.value }))}>
                  <option value="general">General</option>
                  <option value="announcement">Announcement</option>
                  <option value="important">Important</option>
                  <option value="urgent">Urgent</option>
                </select>
                {(notificationForm.audience === "village" || notificationForm.audience === "all_students") && (
                  <select className="input" value={notificationForm.village} onChange={(e) => setNotificationForm((current) => ({ ...current, village: e.target.value }))}>
                    <option value="">Target village</option>
                    {bootstrap.villages.map((village) => (
                      <option key={village._id} value={village.name}>{village.name}</option>
                    ))}
                  </select>
                )}
                {(notificationForm.audience === "category" || notificationForm.audience === "all_teachers") && (
                  <select className="input" value={notificationForm.category} onChange={(e) => setNotificationForm((current) => ({ ...current, category: e.target.value }))}>
                    <option value="">Target category</option>
                    {bootstrap.categories.map((category) => (
                      <option key={category._id} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                )}
              </div>
              {notificationForm.audience === "selected_users" && (
                <input className="input" placeholder="Selected user emails or IDs (comma separated)" value={notificationForm.selectedUsers} onChange={(e) => setNotificationForm((current) => ({ ...current, selectedUsers: e.target.value }))} />
              )}
              <input className="input" type="datetime-local" value={notificationForm.scheduledAt} onChange={(e) => setNotificationForm((current) => ({ ...current, scheduledAt: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={notificationForm.draft} onChange={(e) => setNotificationForm((current) => ({ ...current, draft: e.target.checked }))} />
                Save as draft
              </label>
              <button type="submit" className="btn-primary w-full" disabled={sectionLoading === "notification-create"}>
                {sectionLoading === "notification-create" ? "Saving..." : "Save Notification"}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="font-semibold text-gray-950">Recent Notifications</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {(bootstrap.notifications || []).slice(0, 12).map((notification) => (
                  <div key={notification._id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-gray-950">{notification.title}</h3>
                          <span className={notification.priority === "high" ? "badge-rejected" : "badge-approved"}>
                            {notification.priority}
                          </span>
                          <span className="badge bg-slate-100 text-slate-700">{notification.audience}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-500">{formatResultDate(notification.createdAt)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => resendNotification(notification._id)}>
                        Resend
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <CountListCard
              title="Delivery Snapshot"
              subtitle="Rough operational view of sent notifications"
              data={[
                { label: "Total Sent", count: bootstrap.notifications.length },
                { label: "Drafts", count: bootstrap.notifications.filter((item) => item.metadata?.draft).length },
                { label: "Urgent / Important", count: bootstrap.notifications.filter((item) => item.priority === "high").length },
                { label: "Auto Notifications", count: bootstrap.notifications.filter((item) => item.type === "auto").length },
              ]}
            />
          </div>
        </div>
      )}

      {activeTab === "master" && can("manage_villages") && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-gray-950">Village Management</h2>
              <form onSubmit={createVillage} className="mb-4 flex gap-2">
                <input className="input" placeholder="New village" value={newVillage} onChange={(e) => setNewVillage(e.target.value)} />
                <button type="submit" className="btn-primary" disabled={sectionLoading === "village-create"}>Add</button>
              </form>
              <div className="space-y-2">
                {bootstrap.villages.map((village) => (
                  <div key={village._id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <div>
                      <p className="font-medium text-gray-900">{village.name}</p>
                      <p className="text-xs text-gray-500">{village.status}</p>
                    </div>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => patchVillage(village._id, { status: village.status === "active" ? "disabled" : "active" })}>
                      {village.status === "active" ? "Disable" : "Enable"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-gray-950">Category Management</h2>
              <form onSubmit={createCategory} className="mb-4 flex gap-2">
                <input className="input" placeholder="New category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                <button type="submit" className="btn-primary" disabled={sectionLoading === "category-create"}>Add</button>
              </form>
              <div className="space-y-2">
                {bootstrap.categories.map((category) => (
                  <div key={category._id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <div>
                      <p className="font-medium text-gray-900">{category.name}</p>
                      <p className="text-xs text-gray-500">{category.status}</p>
                    </div>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => patchCategory(category._id, { status: category.status === "active" ? "disabled" : "active" })}>
                      {category.status === "active" ? "Disable" : "Enable"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-gray-950">Institution Management</h2>
              <form onSubmit={createInstitution} className="mb-4 space-y-3">
                <input className="input" placeholder="Institution name" value={newInstitution.name} onChange={(e) => setNewInstitution((current) => ({ ...current, name: e.target.value }))} />
                <select className="input" value={newInstitution.type} onChange={(e) => setNewInstitution((current) => ({ ...current, type: e.target.value }))}>
                  <option value="school">School</option>
                  <option value="college">College</option>
                </select>
                <button type="submit" className="btn-primary w-full" disabled={sectionLoading === "institution-create"}>
                  Add Institution
                </button>
              </form>
              <form onSubmit={mergeInstitutions} className="space-y-3 rounded-lg border border-dashed border-gray-300 p-3">
                <p className="text-sm font-medium text-gray-900">Merge duplicate names</p>
                <select className="input" value={mergeForm.primaryId} onChange={(e) => setMergeForm((current) => ({ ...current, primaryId: e.target.value }))}>
                  <option value="">Primary institution</option>
                  {bootstrap.institutions.map((institution) => (
                    <option key={institution._id} value={institution._id}>{institution.name}</option>
                  ))}
                </select>
                <select className="input" value={mergeForm.duplicateId} onChange={(e) => setMergeForm((current) => ({ ...current, duplicateId: e.target.value }))}>
                  <option value="">Duplicate institution</option>
                  {bootstrap.institutions.map((institution) => (
                    <option key={institution._id} value={institution._id}>{institution.name}</option>
                  ))}
                </select>
                <button type="submit" className="btn-secondary w-full" disabled={sectionLoading === "institution-merge"}>
                  Merge
                </button>
              </form>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-semibold text-gray-950">Institution Directory</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    {["Name", "Type", "Aliases", "Status", "Actions"].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bootstrap.institutions.map((institution) => (
                    <tr key={institution._id}>
                      <td className="px-4 py-3 font-medium text-gray-950">{institution.name}</td>
                      <td className="px-4 py-3 text-gray-600">{institution.type}</td>
                      <td className="px-4 py-3 text-gray-600">{(institution.aliases || []).join(", ") || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{institution.status || "active"}</td>
                      <td className="px-4 py-3">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => patchInstitution(institution._id, { status: institution.status === "disabled" ? "active" : "disabled" })}>
                          {institution.status === "disabled" ? "Enable" : "Disable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "analytics" && can("view_analytics") && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <HorizontalBarChart
              title="Top Villages"
              subtitle="Student count and average performance"
              data={(bootstrap.analytics.villageAnalytics || [])
                .slice(0, 10)
                .map((item) => ({ label: item.label, avgScore: item.avgPerformance, count: item.studentCount }))}
            />
            <HorizontalBarChart
              title="Teacher Workload"
              subtitle="Review count and approval rate"
              data={teacherAnalytics.map((item) => ({
                label: item.label,
                avgScore: item.approvalRate,
                count: item.reviewCount,
              }))}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <CountListCard
              title="Institution Analytics"
              subtitle="Where students are studying"
              data={(bootstrap.analytics.institutionAnalytics || [])
                .slice(0, 12)
                .map((item) => ({ label: `${item.label} (${item.type})`, count: item.count }))}
            />
            <CountListCard
              title="Category Analytics"
              subtitle="Distribution across education levels"
              data={(bootstrap.analytics.categoryAnalytics || []).map((item) => ({ label: item.label, count: item.count }))}
            />
          </div>

          <CategoryScoreboard
            scoreboards={categoryScoreboards}
            onView={openFileViewer}
            formatScore={formatResultScore}
          />
        </div>
      )}

      {activeTab === "system" && can("view_system_health") && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Server" value={bootstrap.systemHealth.serverStatus || "ok"} icon="SV" color="indigo" />
            <StatCard label="MongoDB" value={bootstrap.systemHealth.mongoStatus || "ok"} icon="DB" color="emerald" />
            <StatCard label="Drive" value={bootstrap.systemHealth.googleDriveStatus || "ok"} icon="GD" color="amber" />
            <StatCard label="API" value={bootstrap.systemHealth.apiHealth || "healthy"} icon="AP" color="red" />
          </div>

          {/* ── Google Drive Connection Banner ── */}
          {(() => {
            const drv = bootstrap.storage.drive || {};
            return (
              <div className={`rounded-xl border px-5 py-4 flex items-start gap-4 ${drv.connected === false ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                <div className={`mt-0.5 h-3 w-3 rounded-full shrink-0 ${drv.connected === false ? "bg-red-500" : "bg-emerald-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${drv.connected === false ? "text-red-700" : "text-emerald-700"}`}>
                    Google Drive {drv.connected === false ? "Disconnected" : "Connected"}
                  </p>
                  {drv.connected !== false && (
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Account: <span className="font-medium">{drv.quota?.driveUser || "—"}</span>
                      {drv.rootFolderName && (<> &nbsp;·&nbsp; Root folder: <span className="font-medium">{drv.rootFolderName}</span></>)}
                      {drv.rootFolderId && (
                        <> &nbsp;·&nbsp;
                          <a
                            href={`https://drive.google.com/drive/folders/${drv.rootFolderId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Open in Drive ↗
                          </a>
                        </>
                      )}
                    </p>
                  )}
                  {drv.error && <p className="text-xs text-red-600 mt-0.5">{drv.error}</p>}
                </div>
              </div>
            );
          })()}

          {/* ── Storage Stats Grid ── */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Files</p>
              <p className="mt-2 text-3xl font-bold text-gray-950">{bootstrap.storage.totalFiles ?? 0}</p>
              <p className="mt-1 text-xs text-gray-400">Inside root Drive folder</p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Storage Used</p>
              <p className="mt-2 text-3xl font-bold text-gray-950">{formatBytes(bootstrap.storage.storageUsed ?? 0)}</p>
              <p className="mt-1 text-xs text-gray-400">Across all upload batches</p>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Failed Uploads</p>
              <p className="mt-2 text-3xl font-bold text-gray-950">{bootstrap.storage.failedUploads ?? 0}</p>
              <p className="mt-1 text-xs text-gray-400">Errors logged</p>
            </div>
          </div>

          {/* ── Folder Breakdown ── */}
          {(bootstrap.storage.drive?.folderBreakdown?.length > 0) && (
            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="font-semibold text-gray-950">Drive Folder Breakdown</h2>
                <p className="mt-1 text-xs text-gray-500">Hour-based upload batches inside root Drive folder</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      {["Folder", "Files", "Size", "Created"].map((h) => (
                        <th key={h} className="px-5 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bootstrap.storage.drive.folderBreakdown.map((folder) => (
                      <tr key={folder.folderName} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-950">{folder.folderName}</td>
                        <td className="px-5 py-3 text-gray-600">{folder.fileCount}</td>
                        <td className="px-5 py-3 text-gray-600">{formatBytes(folder.totalSize || 0)}</td>
                        <td className="px-5 py-3 text-gray-500">{formatResultDate(folder.createdTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="card p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">Storage Actions</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => runStorageAction("sync-drive-metadata")}>
                Sync Drive Metadata
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => runStorageAction("verify-file-integrity")}>
                Verify File Integrity
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => runStorageAction("download-metadata-backup")}>
                Download Metadata Backup
              </button>
              <button type="button" className="btn-danger btn-sm" onClick={() => runStorageAction("delete-orphan-files", true)}>
                Delete Orphan Files
              </button>
            </div>
          </div>

          {/* ── Largest + Recent Files ── */}
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="font-semibold text-gray-950">Largest Files</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {(bootstrap.storage.largestFiles || []).slice(0, 8).map((item) => (
                  <div key={item._id} className="flex items-center justify-between px-5 py-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-950">{item.studentName}</p>
                      <p className="text-xs text-gray-500">{item.originalFileName || item.driveFileId}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-600">{formatBytes(item.fileSize || 0)}</span>
                      {item.driveLink && (
                        <a href={item.driveLink} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-500 hover:underline">
                          View ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {(bootstrap.storage.largestFiles || []).length === 0 && (
                  <p className="px-5 py-6 text-sm text-gray-400 text-center">No files yet.</p>
                )}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="font-semibold text-gray-950">Recent Uploads</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {(bootstrap.storage.recentUploads || []).slice(0, 8).map((item) => (
                  <div key={item._id} className="flex items-center justify-between px-5 py-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-950">{item.studentName}</p>
                      <p className="text-xs text-gray-500">{item.originalFileName || item.category}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-600">{formatResultDate(item.createdAt)}</span>
                      {item.driveLink && (
                        <a href={item.driveLink} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-500 hover:underline">
                          View ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {(bootstrap.storage.recentUploads || []).length === 0 && (
                  <p className="px-5 py-6 text-sm text-gray-400 text-center">No uploads yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Backup Center (moved below) ── */}
          <CountListCard
            title="Backup Center"
            subtitle="Export lightweight operational backups"
            data={backupExports.map((item) => ({ label: item.label, count: item.rows.length }))}
          />

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-gray-950">Moderation Queue</h2>
                <p className="mt-1 text-xs text-gray-500">Duplicate uploads, suspicious patterns, and invalid file flags.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    {["Student", "Reason", "Result IDs", "Actions"].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(bootstrap.moderation || []).map((item) => (
                    <tr key={`${item.resultIds?.[0] || item.studentName}-${item.reason}`}>
                      <td className="px-4 py-3 font-medium text-gray-950">{item.studentName}</td>
                      <td className="px-4 py-3 text-gray-600">{item.reason}</td>
                      <td className="px-4 py-3 text-gray-600">{(item.resultIds || []).join(", ")}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => resolveModeration(item.resultIds?.[0], "ignored")}>
                            Ignore
                          </button>
                          <button type="button" className="btn-success btn-sm" onClick={() => resolveModeration(item.resultIds?.[0], "resolved")}>
                            Resolve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(bootstrap.moderation || []).length === 0 && (
              <EmptyState icon="🛡️" title="No moderation flags" description="Nothing suspicious is waiting for admin action right now." />
            )}
          </div>

          {can("view_audit_logs") && (
            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-950">Audit Logs</h2>
                    <p className="mt-1 text-xs text-gray-500">Centralized history of platform actions and administrative changes.</p>
                  </div>
                  <button type="button" className="btn-secondary btn-sm" onClick={exportAuditLogs}>
                    Export Logs
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input className="input" placeholder="Search action, module, target" value={auditFilters.search} onChange={(e) => setAuditFilters((current) => ({ ...current, search: e.target.value }))} />
                  <input className="input" placeholder="Module filter" value={auditFilters.module} onChange={(e) => setAuditFilters((current) => ({ ...current, module: e.target.value }))} />
                  <button type="button" className="btn-primary" onClick={() => runTask(fetchAuditLogs, { loadingKey: "audit-fetch" })}>
                    {sectionLoading === "audit-fetch" ? "Loading..." : "Apply Filters"}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {auditState.data.map((log) => (
                  <div key={log._id} className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-950">{log.action}</p>
                      <p className="text-xs text-gray-500">
                        {log.module} • {log.userId?.name || "System"} • {log.targetId || "No target"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">{formatResultDate(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-950">Backup Exports</h2>
              <p className="mt-1 text-sm text-gray-500">Quick spreadsheet exports for recovery, reporting, or external archival.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {backupExports.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() =>
                    exportSectionsToExcel({
                      title: `${item.label} Backup`,
                      fileName: item.fileName,
                      sections: [{ title: item.label, columns: item.columns, rows: item.rows }],
                    })
                  }
                >
                  Export {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <FileViewerModal isOpen={fileViewer.open} file={fileViewer.file} onClose={closeFileViewer} />
    </div>
  );
};

export default AdminPanel;