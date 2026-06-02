import { formatResultDate } from "../../utils/resultFormatters";

const typeStyles = {
  custom: "border-red-200 bg-red-50 text-red-700",
  auto: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const typeLabels = {
  custom: "High priority",
  auto: "Auto achievement",
};

const NotificationItem = ({ notification }) => (
  <div className={`rounded-lg border p-4 ${typeStyles[notification.type] || typeStyles.auto}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-gray-950">{notification.title}</h3>
          <span className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            {typeLabels[notification.type] || notification.type}
          </span>
          {!notification.read && (
            <span className="rounded-md bg-gray-950 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              New
            </span>
          )}
        </div>
        <p className="mt-2 text-sm leading-6 text-gray-700">{notification.message}</p>
        <p className="mt-2 text-xs text-gray-500">{formatResultDate(notification.createdAt)}</p>
      </div>
    </div>
  </div>
);

const NotificationCenter = ({ notifications, unreadCount, loading, error, onRefresh, onMarkAllRead }) => (
  <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold text-gray-950">Notifications</h2>
        <p className="text-sm text-gray-500">
          {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}` : "All caught up"}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={onMarkAllRead} disabled={loading || unreadCount === 0}>
          Mark Read
        </button>
      </div>
    </div>

    <div className="space-y-3 p-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="py-6 text-center text-sm text-gray-500">Loading notifications...</p>}
      {!loading && notifications.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">No notifications yet.</p>
      )}
      {!loading && notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  </div>
);

export default NotificationCenter;
