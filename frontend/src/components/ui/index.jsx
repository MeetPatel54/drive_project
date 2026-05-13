// ── StatusBadge ────────────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
  const map = {
    pending:  "badge-pending",
    approved: "badge-approved",
    rejected: "badge-rejected",
  };
  return <span className={map[status] || "badge"}>{status}</span>;
};

// ── StatCard ───────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, icon, color = "indigo" }) => {
  const colors = {
    indigo:  "bg-indigo-50  text-indigo-600",
    amber:   "bg-amber-50   text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red:     "bg-red-50     text-red-600",
  };
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// ── Spinner ────────────────────────────────────────────────────────────────
export const Spinner = ({ size = "md" }) => {
  const sizes = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" };
  return (
    <div className={`animate-spin rounded-full border-b-2 border-indigo-600 ${sizes[size]}`} />
  );
};

// ── PageLoader ─────────────────────────────────────────────────────────────
export const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <Spinner size="lg" />
  </div>
);

// ── EmptyState ─────────────────────────────────────────────────────────────
export const EmptyState = ({ icon = "📭", title, description, action }) => (
  <div className="text-center py-16">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    {description && <p className="text-gray-500 text-sm mb-6">{description}</p>}
    {action}
  </div>
);

// ── ErrorMessage ───────────────────────────────────────────────────────────
export const ErrorMessage = ({ message }) =>
  message ? (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
      {message}
    </div>
  ) : null;

// ── SuccessMessage ─────────────────────────────────────────────────────────
export const SuccessMessage = ({ message }) =>
  message ? (
    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg">
      {message}
    </div>
  ) : null;
