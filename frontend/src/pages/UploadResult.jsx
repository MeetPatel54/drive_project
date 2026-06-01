import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { ErrorMessage, SuccessMessage } from "../components/ui";

const RESULT_CATEGORIES = [
  "1st-10th",
  "11th-12th & Diploma",
  "Undergraduate",
  "Postgraduate",
  "Government Exams",
];
const NATIVE_VILLAGES = ["Visnagar", "Kansa", "Basna", "Kamana", "Valam"];
const STANDARDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const HIGHER_SECONDARY_TYPES = ["11th", "12th", "Diploma"];
const STREAMS = ["Science", "Commerce", "Arts"];
const DIPLOMA_COURSES = [
  "Diploma Computer Engineering",
  "Diploma Information Technology",
  "Diploma Mechanical Engineering",
  "Diploma Civil Engineering",
  "Diploma Electrical Engineering",
  "Diploma Electronics & Communication",
  "Diploma Automobile Engineering",
  "Diploma Chemical Engineering",
  "Diploma Instrumentation & Control",
  "Diploma Pharmacy",
  "Diploma Architecture Assistantship",
  "Diploma Textile Engineering",
  "Diploma Mining Engineering",
  "Diploma Metallurgy",
  "Other",
];
const UNDERGRADUATE_COURSES = [
  "B.E.",
  "B.Tech",
  "MBBS",
  "BDS",
  "BAMS",
  "BHMS",
  "B.Sc Nursing",
  "BCA",
  "BBA",
  "B.Com",
  "B.Sc",
  "B.A.",
  "B.Pharm",
  "B.Arch",
  "BSW",
  "Other",
];
const POSTGRADUATE_COURSES = [
  "M.E.",
  "M.Tech",
  "MBA",
  "MCA",
  "M.Com",
  "M.Sc",
  "M.A.",
  "M.Pharm",
  "MS",
  "MD",
  "MDS",
  "Other",
];
const GOVERNMENT_EXAMS = [
  "GPSC",
  "GSSSB",
  "GPSSB",
  "TET",
  "HTAT",
  "GSET",
  "PSI",
  "Constable",
  "Talati",
  "Gram Sevak",
  "Junior Clerk",
  "Senior Clerk",
  "Other",
];

const initialForm = (user) => ({
  studentName: user?.name || "",
  examYear: new Date().getFullYear().toString(),
  category: "",
  subCategory: "",
  stream: "",
  course: "",
  description: "",
  educationDetails: {},
});

const FieldError = ({ message }) =>
  message ? <p className="mt-1 text-xs font-medium text-red-600">{message}</p> : null;

const FormField = ({
  label,
  name,
  value,
  onChange,
  error,
  required = true,
  type = "text",
  placeholder = "",
  min,
  max,
  step,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      className={`input ${error ? "border-red-300 focus:ring-red-500" : ""}`}
      name={name}
      type={type}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={value || ""}
      onChange={onChange}
      required={required}
    />
    <FieldError message={error} />
  </div>
);

const SelectField = ({ label, name, value, onChange, options, error, required = true, placeholder = "Select option" }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      className={`input ${error ? "border-red-300 focus:ring-red-500" : ""}`}
      name={name}
      value={value || ""}
      onChange={onChange}
      required={required}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
    <FieldError message={error} />
  </div>
);

const UploadResult = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => initialForm(user));
  const [profileVillage, setProfileVillage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const nativeVillage = user?.nativeVillage || user?.village || "";
  const isHigherSecondary = form.category === "11th-12th & Diploma";
  const isStandardSchool = form.category === "1st-10th";
  const isDiploma = isHigherSecondary && form.subCategory === "Diploma";
  const isHigherSchool = isHigherSecondary && ["11th", "12th"].includes(form.subCategory);
  const isUndergraduate = form.category === "Undergraduate";
  const isPostgraduate = form.category === "Postgraduate";
  const isGovernmentExam = form.category === "Government Exams";

  const visibleDetails = useMemo(() => {
    if (isStandardSchool || isHigherSchool) {
      return ["percentileRank", "totalMarks", "obtainedMarks", "schoolName"];
    }
    if (isDiploma || isUndergraduate || isPostgraduate) {
      return ["collegeName", "totalCGPA", "obtainedCGPA"];
    }
    if (isGovernmentExam) {
      return ["qualifiedExamName", "rank", "totalMarks", "obtainedMarks", "designationObtained"];
    }
    return [];
  }, [isStandardSchool, isHigherSchool, isDiploma, isUndergraduate, isPostgraduate, isGovernmentExam]);

  const setTopLevel = (field) => (e) => {
    const value = e.target.value;
    setErrors((current) => ({ ...current, [field]: "" }));

    if (field === "category") {
      setForm((current) => ({
        ...current,
        category: value,
        subCategory: "",
        stream: "",
        course: "",
        description: "",
        educationDetails: {},
      }));
      return;
    }

    if (field === "subCategory") {
      setForm((current) => ({
        ...current,
        subCategory: value,
        stream: "",
        course: "",
        educationDetails: {},
      }));
      return;
    }

    setForm((current) => ({ ...current, [field]: value }));
  };

  const setDetail = (field) => (e) => {
    const value = e.target.value;
    setErrors((current) => ({ ...current, [`educationDetails.${field}`]: "" }));
    setForm((current) => ({
      ...current,
      educationDetails: {
        ...current.educationDetails,
        [field]: value,
      },
    }));
  };

  const validateNumber = (field, label, { required = true, min = 0, max = Infinity } = {}, nextErrors) => {
    const value = form.educationDetails[field];
    if (!required && (value === undefined || value === "")) return;
    const number = Number(value);
    if (value === undefined || value === "" || Number.isNaN(number)) {
      nextErrors[`educationDetails.${field}`] = `${label} is required`;
      return;
    }
    if (number < min || number > max) {
      nextErrors[`educationDetails.${field}`] = `${label} must be between ${min} and ${max}`;
    }
  };

  const validateText = (field, label, nextErrors, required = true) => {
    const value = form.educationDetails[field];
    if (required && !String(value || "").trim()) {
      nextErrors[`educationDetails.${field}`] = `${label} is required`;
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!nativeVillage) nextErrors.nativeVillage = "Native village is required before uploading";
    if (!form.studentName.trim()) nextErrors.studentName = "Student name is required";
    if (!form.category) nextErrors.category = "Please select a result category";
    if (!file) nextErrors.file = "Please select a result file";

    if (isStandardSchool) {
      if (!form.subCategory) nextErrors.subCategory = "Standard is required";
      validateNumber("percentileRank", "Percentile rank", { min: 0, max: 100 }, nextErrors);
      validateNumber("totalMarks", "Total marks", { min: 0 }, nextErrors);
      validateNumber("obtainedMarks", "Obtained marks", { min: 0 }, nextErrors);
      validateText("schoolName", "School name", nextErrors);
    }

    if (isHigherSecondary) {
      if (!form.subCategory) nextErrors.subCategory = "Education type is required";

      if (isHigherSchool) {
        if (!form.stream) nextErrors.stream = "Stream is required";
        validateNumber("percentileRank", "Percentile rank", { min: 0, max: 100 }, nextErrors);
        validateNumber("totalMarks", "Total marks", { min: 0 }, nextErrors);
        validateNumber("obtainedMarks", "Obtained marks", { min: 0 }, nextErrors);
        validateText("schoolName", "School name", nextErrors);
      }

      if (isDiploma) {
        if (!form.course) nextErrors.course = "Diploma course is required";
        validateText("collegeName", "College name", nextErrors);
        validateNumber("totalCGPA", "Total CGPA", { min: 0.1, max: 10 }, nextErrors);
        validateNumber("obtainedCGPA", "Obtained CGPA", { min: 0, max: 10 }, nextErrors);
      }
    }

    if (isUndergraduate || isPostgraduate) {
      if (!form.course) nextErrors.course = "Course is required";
      validateText("collegeName", "College name", nextErrors);
      validateNumber("totalCGPA", "Total CGPA", { min: 0.1, max: 10 }, nextErrors);
      validateNumber("obtainedCGPA", "Obtained CGPA", { min: 0, max: 10 }, nextErrors);
    }

    if (isGovernmentExam) {
      validateText("qualifiedExamName", "Qualified government exam name", nextErrors);
      validateNumber("rank", "Rank", { required: false, min: 1 }, nextErrors);
      validateNumber("totalMarks", "Total marks", { required: false, min: 0 }, nextErrors);
      validateNumber("obtainedMarks", "Obtained marks", { required: false, min: 0 }, nextErrors);
    }

    const totalMarks = Number(form.educationDetails.totalMarks);
    const obtainedMarks = Number(form.educationDetails.obtainedMarks);
    if (
      form.educationDetails.totalMarks !== undefined &&
      form.educationDetails.obtainedMarks !== undefined &&
      Number.isFinite(totalMarks) &&
      Number.isFinite(obtainedMarks) &&
      obtainedMarks > totalMarks
    ) {
      nextErrors["educationDetails.obtainedMarks"] = "Obtained marks cannot exceed total marks";
    }

    const totalCGPA = Number(form.educationDetails.totalCGPA);
    const obtainedCGPA = Number(form.educationDetails.obtainedCGPA);
    if (
      form.educationDetails.totalCGPA !== undefined &&
      form.educationDetails.obtainedCGPA !== undefined &&
      Number.isFinite(totalCGPA) &&
      Number.isFinite(obtainedCGPA) &&
      obtainedCGPA > totalCGPA
    ) {
      nextErrors["educationDetails.obtainedCGPA"] = "Obtained CGPA cannot exceed total CGPA";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleProfileCompletion = async () => {
    if (!profileVillage) {
      setErrors((current) => ({ ...current, nativeVillage: "Please select your native village" }));
      return;
    }

    setProfileSaving(true);
    setError("");
    try {
      await updateProfile({ nativeVillage: profileVillage });
      setErrors((current) => ({ ...current, nativeVillage: "" }));
    } catch (err) {
      const responseErrors = err.response?.data?.errors;
      setError(
        responseErrors
          ? responseErrors.map((item) => item.message).join(", ")
          : err.response?.data?.error || "Could not update profile."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) {
      setError("Please fix the highlighted fields.");
      return;
    }

    const details = Object.fromEntries(
      visibleDetails
        .map((key) => [key, form.educationDetails[key]])
        .filter(([, value]) => value !== undefined && value !== "")
    );

    const formData = new FormData();
    formData.append("studentName", form.studentName.trim());
    formData.append("examYear", form.examYear.trim());
    formData.append("category", form.category);
    formData.append("subCategory", form.subCategory);
    formData.append("stream", form.stream);
    formData.append("course", form.course);
    formData.append("description", form.description.trim());
    formData.append("educationDetails", JSON.stringify(details));
    formData.append("file", file);

    setLoading(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 85));
    }, 300);

    try {
      await api.post("/results/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(interval);
      setProgress(100);
      setSuccess("Result uploaded successfully! Awaiting teacher approval.");
      setTimeout(() => navigate("/student"), 1500);
    } catch (err) {
      clearInterval(interval);
      const responseErrors = err.response?.data?.errors;
      if (responseErrors) {
        setErrors(Object.fromEntries(responseErrors.map((item) => [item.field, item.message])));
      }
      setError(
        responseErrors
          ? responseErrors.map((item) => item.message).join(", ")
          : err.response?.data?.error || "Upload failed."
      );
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const renderMarksFields = () => (
    <>
      <FormField
        label="Percentile Rank"
        name="percentileRank"
        type="number"
        min="0"
        max="100"
        step="0.01"
        placeholder="e.g. 92.4"
        value={form.educationDetails.percentileRank}
        onChange={setDetail("percentileRank")}
        error={errors["educationDetails.percentileRank"]}
      />
      <FormField
        label="Total Marks"
        name="totalMarks"
        type="number"
        min="0"
        step="0.01"
        placeholder="e.g. 700"
        value={form.educationDetails.totalMarks}
        onChange={setDetail("totalMarks")}
        error={errors["educationDetails.totalMarks"]}
      />
      <FormField
        label="Obtained Marks"
        name="obtainedMarks"
        type="number"
        min="0"
        step="0.01"
        placeholder="e.g. 612"
        value={form.educationDetails.obtainedMarks}
        onChange={setDetail("obtainedMarks")}
        error={errors["educationDetails.obtainedMarks"]}
      />
      <FormField
        label="School Name"
        name="schoolName"
        placeholder="School name"
        value={form.educationDetails.schoolName}
        onChange={setDetail("schoolName")}
        error={errors["educationDetails.schoolName"]}
      />
    </>
  );

  const renderCgpaFields = () => (
    <>
      <FormField
        label="College Name"
        name="collegeName"
        placeholder="College name"
        value={form.educationDetails.collegeName}
        onChange={setDetail("collegeName")}
        error={errors["educationDetails.collegeName"]}
      />
      <FormField
        label="Total CGPA"
        name="totalCGPA"
        type="number"
        min="0.1"
        max="10"
        step="0.01"
        placeholder="e.g. 10"
        value={form.educationDetails.totalCGPA}
        onChange={setDetail("totalCGPA")}
        error={errors["educationDetails.totalCGPA"]}
      />
      <FormField
        label="Obtained CGPA"
        name="obtainedCGPA"
        type="number"
        min="0"
        max="10"
        step="0.01"
        placeholder="e.g. 8.72"
        value={form.educationDetails.obtainedCGPA}
        onChange={setDetail("obtainedCGPA")}
        error={errors["educationDetails.obtainedCGPA"]}
      />
    </>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button onClick={() => navigate("/student")} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          ← Back to dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Upload Result</h1>
        <p className="text-gray-500 text-sm mt-1">Submit your result for teacher review</p>
      </div>

      <div className="card p-5 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Student Profile</p>
            <p className="mt-1 text-sm text-gray-700">
              Native village: <span className="font-semibold text-gray-900">{nativeVillage || "Not selected"}</span>
            </p>
            {!nativeVillage && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select
                  className="input bg-white sm:max-w-xs"
                  value={profileVillage}
                  onChange={(e) => {
                    setProfileVillage(e.target.value);
                    setErrors((current) => ({ ...current, nativeVillage: "" }));
                  }}
                >
                  <option value="">Select native village</option>
                  {NATIVE_VILLAGES.map((village) => (
                    <option key={village} value={village}>{village}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleProfileCompletion}
                  disabled={profileSaving}
                  className="btn-primary whitespace-nowrap"
                >
                  {profileSaving ? "Saving..." : "Save Village"}
                </button>
              </div>
            )}
            <FieldError
              message={
                errors.nativeVillage ||
                (!nativeVillage ? "Please complete registration with a native village before uploading." : "")
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label="Student Name"
                name="studentName"
                value={form.studentName}
                onChange={setTopLevel("studentName")}
                error={errors.studentName}
              />
            </div>
            <FormField
              label="Exam Year"
              name="examYear"
              value={form.examYear}
              onChange={setTopLevel("examYear")}
              error={errors.examYear}
              placeholder="2026"
              required={false}
            />
            <SelectField
              label="Result Category"
              name="category"
              value={form.category}
              onChange={setTopLevel("category")}
              options={RESULT_CATEGORIES}
              error={errors.category}
              placeholder="Select category"
            />
          </div>

          {form.category && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {isStandardSchool && (
                  <>
                    <SelectField
                      label="Standard"
                      name="subCategory"
                      value={form.subCategory}
                      onChange={setTopLevel("subCategory")}
                      options={STANDARDS}
                      error={errors.subCategory}
                      placeholder="Select standard"
                    />
                    <div className="hidden sm:block" />
                    {renderMarksFields()}
                  </>
                )}

                {isHigherSecondary && (
                  <>
                    <SelectField
                      label="Education Type"
                      name="subCategory"
                      value={form.subCategory}
                      onChange={setTopLevel("subCategory")}
                      options={HIGHER_SECONDARY_TYPES}
                      error={errors.subCategory}
                      placeholder="Select 11th, 12th, or Diploma"
                    />
                    {isHigherSchool && (
                      <SelectField
                        label="Stream"
                        name="stream"
                        value={form.stream}
                        onChange={setTopLevel("stream")}
                        options={STREAMS}
                        error={errors.stream}
                        placeholder="Select stream"
                      />
                    )}
                    {isDiploma && (
                      <SelectField
                        label="Diploma Course"
                        name="course"
                        value={form.course}
                        onChange={setTopLevel("course")}
                        options={DIPLOMA_COURSES}
                        error={errors.course}
                        placeholder="Select diploma course"
                      />
                    )}
                    {isHigherSchool && renderMarksFields()}
                    {isDiploma && renderCgpaFields()}
                  </>
                )}

                {isUndergraduate && (
                  <>
                    <SelectField
                      label="Course"
                      name="course"
                      value={form.course}
                      onChange={setTopLevel("course")}
                      options={UNDERGRADUATE_COURSES}
                      error={errors.course}
                      placeholder="Select undergraduate course"
                    />
                    <div className="hidden sm:block" />
                    {renderCgpaFields()}
                  </>
                )}

                {isPostgraduate && (
                  <>
                    <SelectField
                      label="Course"
                      name="course"
                      value={form.course}
                      onChange={setTopLevel("course")}
                      options={POSTGRADUATE_COURSES}
                      error={errors.course}
                      placeholder="Select postgraduate course"
                    />
                    <div className="hidden sm:block" />
                    {renderCgpaFields()}
                  </>
                )}

                {isGovernmentExam && (
                  <>
                    <SelectField
                      label="Qualified Government Exam Name"
                      name="qualifiedExamName"
                      value={form.educationDetails.qualifiedExamName}
                      onChange={setDetail("qualifiedExamName")}
                      options={GOVERNMENT_EXAMS}
                      error={errors["educationDetails.qualifiedExamName"]}
                      placeholder="Select exam"
                    />
                    <FormField
                      label="Rank"
                      name="rank"
                      type="number"
                      min="1"
                      placeholder="Optional"
                      value={form.educationDetails.rank}
                      onChange={setDetail("rank")}
                      error={errors["educationDetails.rank"]}
                      required={false}
                    />
                    <FormField
                      label="Total Marks"
                      name="totalMarks"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Optional"
                      value={form.educationDetails.totalMarks}
                      onChange={setDetail("totalMarks")}
                      error={errors["educationDetails.totalMarks"]}
                      required={false}
                    />
                    <FormField
                      label="Obtained Marks"
                      name="obtainedMarks"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Optional"
                      value={form.educationDetails.obtainedMarks}
                      onChange={setDetail("obtainedMarks")}
                      error={errors["educationDetails.obtainedMarks"]}
                      required={false}
                    />
                    <div className="sm:col-span-2">
                      <FormField
                        label="Designation Obtained"
                        name="designationObtained"
                        placeholder="Optional"
                        value={form.educationDetails.designationObtained}
                        onChange={setDetail("designationObtained")}
                        error={errors["educationDetails.designationObtained"]}
                        required={false}
                      />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea
                    className="input min-h-[110px] resize-y"
                    placeholder="Add relevant notes about this result"
                    value={form.description}
                    onChange={setTopLevel("description")}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Result File <span className="text-red-500">*</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50"
              } ${errors.file ? "border-red-300 bg-red-50" : ""}`}
              onClick={() => document.getElementById("file-input").click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files[0]);
                  setErrors((current) => ({ ...current, file: "" }));
                }}
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
            <FieldError message={errors.file} />
          </div>

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
