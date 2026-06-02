import { useState } from "react";
import api from "../../services/api";

const initialForm = { title: "", message: "" };

const TeacherNotificationComposer = ({ open, onClose, onSent }) => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const set = (field) => (e) => {
    setForm((current) => ({ ...current, [field]: e.target.value }));
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      setError("Title and message are required.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.post("/notifications", {
        title: form.title.trim(),
        message: form.message.trim(),
      });
      setForm(initialForm);
      onSent?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Could not send notification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-white/20 bg-white p-6 shadow-2xl">
        <div className="mb-5">
          <div className="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold uppercase tracking-wide text-red-700">
            Custom high priority
          </div>
          <h2 className="mt-3 text-lg font-bold text-gray-950">Broadcast Notification</h2>
          <p className="mt-1 text-sm text-gray-500">Send a custom message to every student.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Title</label>
            <input className="input" value={form.title} onChange={set("title")} maxLength={120} placeholder="Important announcement" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Message</label>
            <textarea
              className="input min-h-[130px] resize-y"
              value={form.message}
              onChange={set("message")}
              maxLength={1000}
              placeholder="Write the notification message..."
            />
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? "Sending..." : "Send to All Students"}
            </button>
            <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeacherNotificationComposer;
