import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import FileViewerModal from "../components/FileViewerModal";
import TeacherNotificationComposer from "../components/notifications/TeacherNotificationComposer";
import { StatusBadge, EmptyState, StatCard } from "../components/ui";
import { useFileViewer } from "../hooks/useFileViewer";
import {
  formatResultDate,
  formatResultLevel,
  formatResultScore,
  getScoreColor,
  resultExportColumns,
  resultToExportRow,
} from "../utils/resultFormatters";
import { exportSectionsToExcel, printSectionsAsPdf } from "../utils/exportUtils";

const RESULT_CATEGORIES = ["1st-10th", "11th-12th", "Diploma", "Undergraduate", "Postgraduate", "Government Exams"];

const TeacherDashboard = () => {
  const [results, setResults]   = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actionId, setActionId] = useState(null);
  const [lockError, setLockError] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    category: "",
    minPercentage: "",
    maxPercentage: "",
    village: "",
    institution: "",
    dateFrom: "",
    dateTo: "",
  });
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: "" });
  const [notificationComposerOpen, setNotificationComposerOpen] = useState(false);
  const [notificationSent, setNotificationSent] = useState("");
  const { fileViewer, openFileViewer, closeFileViewer } = useFileViewer();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const [rRes, sRes] = await Promise.all([
        api.get("/results/all", { params: { ...params, limit: 100 } }),
        api.get("/results/stats"),
      ]);
      setResults(rRes.data.data);
      setStats(sRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatus = async (id, status, reason = "") => {
    setActionId(id);
    try {
      await api.patch(`/results/${id}/status`, { status, rejectionReason: reason });
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Action failed.");
    } finally {
      setActionId(null);
      setRejectModal({ open: false, id: null, reason: "" });
    }
  };

  const handleLock = async (id) => {
    setActionId(id);
    setLockError("");
    try {
      await api.post(`/results/${id}/lock`);
      await fetchData();
    } catch (err) {
      setLockError(err.response?.data?.error || "Could not start review.");
    } finally {
      setActionId(null);
    }
  };

  const handleCancelReview = async (id) => {
    setActionId(id);
    setLockError("");
    try {
      await api.post(`/results/${id}/cancel-review`);
      await fetchData();
    } catch (err) {
      setLockError(err.response?.data?.error || "Could not cancel review.");
    } finally {
      setActionId(null);
    }
  };

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const clearFilters = () => setFilters({
    status: "",
    category: "",
    minPercentage: "",
    maxPercentage: "",
    village: "",
    institution: "",
    dateFrom: "",
    dateTo: "",
  });

  const exportRows = results.map(resultToExportRow);
  const exportSections = [{
    title: "Teacher Dashboard Results",
    columns: resultExportColumns,
    rows: exportRows,
  }];

  const exportExcel = () => exportSectionsToExcel({
    title: "Teacher Dashboard Results",
    fileName: "teacher-dashboard-results",
    sections: exportSections,
  });

  const exportPdf = () => printSectionsAsPdf({
    title: "Teacher Dashboard Results",
    sections: exportSections,
  });

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  })();

  const isMyLock = (result) => {
    const reviewerId = result.reviewLock?.reviewerId?._id || result.reviewLock?.reviewerId;
    return reviewerId && currentUser?.id && reviewerId.toString() === currentUser.id.toString();
  };

  const lockReviewerName = (result) => result.reviewLock?.reviewerId?.name || "another teacher";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Review submissions, approve results, and export current views.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" onClick={() => setNotificationComposerOpen(true)}>
            Notify Students
          </button>
          <Link to="/teacher/analytics" className="btn-primary btn-sm">
            Open Analytics
          </Link>
          <button type="button" onClick={exportExcel} className="btn-secondary btn-sm" disabled={!results.length}>
            Export Excel
          </button>
          <button type="button" onClick={exportPdf} className="btn-secondary btn-sm" disabled={!results.length}>
            Export PDF
          </button>
        </div>
      </div>

      {notificationSent && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {notificationSent}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <StatCard label="Total"    value={stats.total}          icon="📄" color="indigo"  />
          <StatCard label="Pending"  value={stats.pending}        icon="⏳" color="amber"   />
          <StatCard label="Under Review" value={stats.underReview || 0} icon="🔎" color="indigo" />
          <StatCard label="Approved" value={stats.approved}       icon="✅" color="emerald" />
          <StatCard label="Rejected" value={stats.rejected}       icon="❌" color="red"     />
          <StatCard label="Avg %"    value={`${stats.avgPercentage}%`} icon="📊" color="indigo" />
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          <select className="input text-sm" value={filters.status} onChange={setFilter("status")}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className="input text-sm" value={filters.category} onChange={setFilter("category")}>
            <option value="">All Categories</option>
            {RESULT_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input className="input text-sm" placeholder="Min %" type="number" value={filters.minPercentage} onChange={setFilter("minPercentage")} />
          <input className="input text-sm" placeholder="Max %" type="number" value={filters.maxPercentage} onChange={setFilter("maxPercentage")} />
          <input className="input text-sm" placeholder="Village..." value={filters.village} onChange={setFilter("village")} />
          <input className="input text-sm" placeholder="School / college..." value={filters.institution} onChange={setFilter("institution")} />
          <input className="input text-sm" type="date" value={filters.dateFrom} onChange={setFilter("dateFrom")} />
          <input className="input text-sm" type="date" value={filters.dateTo} onChange={setFilter("dateTo")} />
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={clearFilters} className="btn-secondary text-sm">
            Clear Filters
          </button>
        </div>
      </div>

      {lockError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {lockError}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Review Queue</h2>
            <p className="text-xs text-gray-500">Showing up to 100 results for the selected filters.</p>
          </div>
          <span className="text-sm text-gray-500">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : results.length === 0 ? (
          <EmptyState icon="🔍" title="No results found" description="Try adjusting your filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Student", "Village", "Category", "Year", "Level", "Score", "Status", "Submitted", "File", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.studentName}</div>
                      <div className="text-xs text-gray-400">{r.userId?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.village || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.category || r.subject || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.examYear || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{formatResultLevel(r)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${getScoreColor(r.percentage)}`}>
                        {formatResultScore(r)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.status === "rejected" && r.rejectionReason && (
                        <p className="text-xs text-red-400 mt-1 max-w-[120px] truncate" title={r.rejectionReason}>
                          {r.rejectionReason}
                        </p>
                      )}
                      {r.status === "under_review" && (
                        <p className="text-xs text-blue-500 mt-1 max-w-[150px] truncate" title={`Currently under review by ${lockReviewerName(r)}`}>
                          Currently under review
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatResultDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openFileViewer(r)}
                        className="btn btn-secondary btn-sm whitespace-nowrap"
                      >
                        View File
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" && (
                        <button
                          onClick={() => handleLock(r._id)}
                          disabled={actionId === r._id}
                          className="btn-primary btn-sm"
                        >
                          {actionId === r._id ? "..." : "Review"}
                        </button>
                      )}
                      {r.status === "under_review" && isMyLock(r) && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStatus(r._id, "approved")}
                            disabled={actionId === r._id}
                            className="btn-success btn-sm"
                          >
                            {actionId === r._id ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() => setRejectModal({ open: true, id: r._id, reason: "" })}
                            className="btn-danger btn-sm"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleCancelReview(r._id)}
                            disabled={actionId === r._id}
                            className="btn-secondary btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {r.status === "under_review" && !isMyLock(r) && (
                        <span className="text-xs text-blue-500">
                          Locked by {lockReviewerName(r)}
                        </span>
                      )}
                      {["approved", "rejected"].includes(r.status) && (
                        <span className="text-xs text-gray-400">
                          {r.reviewedBy?.name || "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-gray-900 mb-2">Reject Result</h3>
            <p className="text-sm text-gray-500 mb-4">Optionally provide a reason for rejection.</p>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Reason for rejection (optional)..."
              value={rejectModal.reason}
              onChange={(e) => setRejectModal((m) => ({ ...m, reason: e.target.value }))}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleStatus(rejectModal.id, "rejected", rejectModal.reason)}
                disabled={actionId === rejectModal.id}
                className="btn-danger flex-1"
              >
                {actionId === rejectModal.id ? "Rejecting..." : "Confirm Reject"}
              </button>
              <button
                onClick={() => setRejectModal({ open: false, id: null, reason: "" })}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <FileViewerModal
        isOpen={fileViewer.open}
        file={fileViewer.file}
        onClose={closeFileViewer}
      />

      <TeacherNotificationComposer
        open={notificationComposerOpen}
        onClose={() => setNotificationComposerOpen(false)}
        onSent={() => {
          setNotificationSent("High-priority notification sent to all students.");
          setTimeout(() => setNotificationSent(""), 3500);
        }}
      />
    </div>
  );
};

export default TeacherDashboard;
