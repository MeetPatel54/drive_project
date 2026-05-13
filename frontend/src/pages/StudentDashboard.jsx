import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { StatusBadge, PageLoader, EmptyState, StatCard } from "../components/ui";

const StudentDashboard = () => {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const fetchResults = async () => {
    try {
      const res = await api.get("/results/my");
      setResults(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResults(); }, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this result? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await api.delete(`/results/${id}`);
      setResults((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed.");
    } finally {
      setDeleting(null);
    }
  };

  const stats = {
    total: results.length,
    approved: results.filter((r) => r.status === "approved").length,
    pending: results.filter((r) => r.status === "pending").length,
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Results</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back, {user.name}</p>
        </div>
        <Link to="/student/upload" className="btn-primary">
          + Upload Result
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Submitted" value={stats.total} icon="📄" color="indigo" />
        <StatCard label="Approved" value={stats.approved} icon="✅" color="emerald" />
        <StatCard label="Pending Review" value={stats.pending} icon="⏳" color="amber" />
      </div>

      {/* Results table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Submitted Results</h2>
        </div>

        {results.length === 0 ? (
          <EmptyState
            icon="📭"
            title="No results yet"
            description="Upload your first result to get started."
            action={
              <Link to="/student/upload" className="btn-primary">
                Upload Result
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Student Name", "Subject", "Year", "Percentage", "Status", "Uploaded", "Actions"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{r.studentName}</td>
                    <td className="px-6 py-4 text-gray-600">{r.subject || "—"}</td>
                    <td className="px-6 py-4 text-gray-600">{r.examYear || "—"}</td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">{r.percentage}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={r.status} />
                      {r.status === "rejected" && r.rejectionReason && (
                        <p className="text-xs text-red-500 mt-1">{r.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <a
                          href={`/api/results/${r._id}/stream?token=${localStorage.getItem("token")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          View
                        </a>
                        {r.status === "pending" && (
                          <button
                            onClick={() => handleDelete(r._id)}
                            disabled={deleting === r._id}
                            className="btn btn-danger btn-sm"
                          >
                            {deleting === r._id ? "..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
