import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { StatusBadge, PageLoader, EmptyState, StatCard } from "../components/ui";

const TeacherDashboard = () => {
  const [results, setResults]   = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actionId, setActionId] = useState(null);
  const [filters, setFilters]   = useState({ status: "", minPercentage: "", maxPercentage: "", village: "" });
  const [rejectModal, setRejectModal] = useState({ open: false, id: null, reason: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const [rRes, sRes] = await Promise.all([
        api.get("/results/all", { params }),
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

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Review and manage student results</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total"    value={stats.total}          icon="📄" color="indigo"  />
          <StatCard label="Pending"  value={stats.pending}        icon="⏳" color="amber"   />
          <StatCard label="Approved" value={stats.approved}       icon="✅" color="emerald" />
          <StatCard label="Rejected" value={stats.rejected}       icon="❌" color="red"     />
          <StatCard label="Avg %"    value={`${stats.avgPercentage}%`} icon="📊" color="indigo" />
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <select className="input text-sm" value={filters.status} onChange={setFilter("status")}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <input className="input text-sm" placeholder="Min %" type="number" value={filters.minPercentage} onChange={setFilter("minPercentage")} />
          <input className="input text-sm" placeholder="Max %" type="number" value={filters.maxPercentage} onChange={setFilter("maxPercentage")} />
          <input className="input text-sm" placeholder="Village..." value={filters.village} onChange={setFilter("village")} />
          <button onClick={() => setFilters({ status: "", minPercentage: "", maxPercentage: "", village: "" })} className="btn-secondary text-sm">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">All Results</h2>
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
                  {["Student", "Village", "Subject", "Year", "Grade", "%", "Status", "Submitted", "File", "Actions"].map((h) => (
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
                    <td className="px-4 py-3 text-gray-600">{r.subject || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.examYear || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.grade || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${r.percentage >= 75 ? "text-emerald-600" : r.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}>
                        {r.percentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.status === "rejected" && r.rejectionReason && (
                        <p className="text-xs text-red-400 mt-1 max-w-[120px] truncate" title={r.rejectionReason}>
                          {r.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/api/results/${r._id}/stream?token=${localStorage.getItem("token")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm whitespace-nowrap"
                      >
                        View File
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" && (
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
                        </div>
                      )}
                      {r.status !== "pending" && (
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
    </div>
  );
};

export default TeacherDashboard;
