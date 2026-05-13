import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { ErrorMessage, SuccessMessage } from "../components/ui";

const UploadResult = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    studentName: user.name,
    village: user.village || "",
    percentage: "",
    grade: "",
    subject: "",
    examYear: new Date().getFullYear().toString(),
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError("Please select a file to upload."); return; }
    setError(""); setSuccess(""); setLoading(true); setProgress(0);

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    formData.append("file", file);

    try {
      // Fake progress
      const interval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 85));
      }, 300);

      await api.post("/results/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(interval);
      setProgress(100);
      setSuccess("Result uploaded successfully! Awaiting teacher approval.");
      setTimeout(() => navigate("/student"), 1500);
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(errors ? errors.map((e) => e.message).join(", ") : err.response?.data?.error || "Upload failed.");
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button onClick={() => navigate("/student")} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          ← Back to dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Upload Result</h1>
        <p className="text-gray-500 text-sm mt-1">Submit your result for teacher review</p>
      </div>

      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Student Name</label>
              <input className="input" value={form.studentName} onChange={set("studentName")} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Village</label>
              <input className="input" placeholder="Your village" value={form.village} onChange={set("village")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Year</label>
              <input className="input" placeholder="2024" value={form.examYear} onChange={set("examYear")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
              <input className="input" placeholder="e.g. Mathematics" value={form.subject} onChange={set("subject")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Grade / Class</label>
              <input className="input" placeholder="e.g. 10th" value={form.grade} onChange={set("grade")} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Percentage <span className="text-red-500">*</span>
              </label>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="e.g. 87.5"
                value={form.percentage}
                onChange={set("percentage")}
                required
              />
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Result File <span className="text-red-500">*</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50"
              }`}
              onClick={() => document.getElementById("file-input").click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0])}
              />
              {file ? (
                <div>
                  <div className="text-3xl mb-2">{file.type.includes("pdf") ? "📄" : "🖼️"}</div>
                  <p className="font-medium text-indigo-700">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-xs text-red-500 mt-2 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-2">📁</div>
                  <p className="font-medium text-gray-700">Click to browse or drag & drop</p>
                  <p className="text-xs text-gray-500 mt-1">PDF or image · Max 10 MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {loading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Uploading to Google Drive...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <ErrorMessage message={error} />
          <SuccessMessage message={success} />

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? "Uploading..." : "Submit Result"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadResult;
