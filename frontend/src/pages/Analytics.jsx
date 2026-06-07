import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import FileViewerModal from "../components/FileViewerModal";
import { ErrorMessage, PageLoader } from "../components/ui";
import {
  AchievementFeed,
  CategoryScoreboard,
  CountListCard,
  DonutChart,
  FilterPanel,
  HorizontalBarChart,
  MetricCard,
} from "../components/analytics";
import { useFileViewer } from "../hooks/useFileViewer";
import { formatResultScore } from "../utils/resultFormatters";
import { exportSectionsToExcel, printSectionsAsPdf } from "../utils/exportUtils";

const emptyFilters = {
  village: "",
  category: "",
  status: "",
  institution: "",
  dateFrom: "",
  dateTo: "",
};

const defaultAnalytics = {
  overview: {
    totalStudents: 0,
    totalResultSubmissions: 0,
    approvedResults: 0,
    pendingResults: 0,
    rejectedResults: 0,
    totalVillagesCovered: 0,
    averagePerformance: 0,
    governmentExamQualifiedStudents: 0,
  },
  villagePerformance: [],
  categoryDistribution: [],
  educationPerformance: [],
  topStudents: [],
  categoryScoreboards: [],
  governmentExamAchievements: [],
  collegeAnalytics: [],
  schoolAnalytics: [],
  approvalAnalytics: [],
  recentAchievements: [],
  filters: {
    villages: [],
    categories: [],
    statuses: [],
    institutions: [],
  },
};

const Analytics = () => {
  const [analytics, setAnalytics] = useState(defaultAnalytics);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { fileViewer, openFileViewer, closeFileViewer } = useFileViewer();

  useEffect(() => {
    setLoading(true);
    setError("");

    const params = Object.fromEntries(
      Object.entries(appliedFilters).filter(([, value]) => value)
    );

    api.get("/results/analytics", { params })
      .then((res) => setAnalytics(res.data.data || defaultAnalytics))
      .catch((err) => {
        console.error(err);
        setError(err.response?.data?.error || "Could not load analytics.");
      })
      .finally(() => setLoading(false));
  }, [appliedFilters]);


  const exportSections = useMemo(() => [
    {
      title: "Overview",
      columns: [
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: Object.entries(analytics.overview || {}).map(([metric, value]) => ({ metric, value })),
    },
    {
      title: "Village Performance",
      columns: [
        { key: "label", label: "Village" },
        { key: "avgScore", label: "Avg Score" },
        { key: "count", label: "Results" },
      ],
      rows: analytics.villagePerformance || [],
    },
    {
      title: "Category Distribution",
      columns: [
        { key: "label", label: "Category" },
        { key: "count", label: "Results" },
        { key: "percentage", label: "Share %" },
      ],
      rows: analytics.categoryDistribution || [],
    },
    {
      title: "Education Performance",
      columns: [
        { key: "label", label: "Category" },
        { key: "avgScore", label: "Avg Score" },
        { key: "count", label: "Results" },
      ],
      rows: analytics.educationPerformance || [],
    },
    {
      title: "Category-wise Scoreboard",
      columns: [
        { key: "category", label: "Category" },
        { key: "studentName", label: "Student" },
        { key: "village", label: "Village" },
        { key: "level", label: "Level" },
        { key: "score", label: "Score" },
      ],
      rows: (analytics.categoryScoreboards || []).flatMap((board) =>
        (board.students || []).map((student) => ({
          category: board.label,
          studentName: student.studentName,
          village: student.village || "-",
          level: [student.course || student.subCategory || student.category, student.stream].filter(Boolean).join(" / ") || "-",
          score: formatResultScore(student),
        }))
      ),
    },
    {
      title: "Government Exams",
      columns: [
        { key: "label", label: "Exam" },
        { key: "count", label: "Qualified" },
      ],
      rows: analytics.governmentExamAchievements || [],
    },
    {
      title: "College Analytics",
      columns: [
        { key: "label", label: "College" },
        { key: "count", label: "Students" },
      ],
      rows: analytics.collegeAnalytics || [],
    },
    {
      title: "School Analytics",
      columns: [
        { key: "label", label: "School" },
        { key: "count", label: "Students" },
      ],
      rows: analytics.schoolAnalytics || [],
    },
  ], [analytics]);

  const setFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  if (loading && !analytics.overview.totalResultSubmissions) return <PageLoader />;

  const overview = analytics.overview || defaultAnalytics.overview;

  const exportExcel = () => exportSectionsToExcel({
    title: "Teacher Analytics",
    fileName: "teacher-analytics",
    sections: exportSections,
  });

  const exportPdf = () => printSectionsAsPdf({
    title: "Teacher Analytics",
    sections: exportSections,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Teacher Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Compare villages, institutions, categories, and student achievements across Visnagar Taluka.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {loading && <span className="self-center text-sm font-medium text-indigo-600">Refreshing...</span>}
          <button type="button" className="btn-secondary btn-sm" onClick={exportExcel}>Export Excel</button>
          <button type="button" className="btn-secondary btn-sm" onClick={exportPdf}>Export PDF</button>
        </div>
      </div>

      <div className="mb-6">
        <FilterPanel
          filters={filters}
          options={analytics.filters || defaultAnalytics.filters}
          onChange={setFilter}
          onApply={applyFilters}
          onClear={clearFilters}
          loading={loading}
        />
      </div>

      <ErrorMessage message={error} />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total Students" value={overview.totalStudents} helper="Registered student accounts" tone="indigo" />
        <MetricCard label="Submissions" value={overview.totalResultSubmissions} helper="Results in current view" tone="cyan" />
        <MetricCard label="Approved" value={overview.approvedResults} helper="Teacher-approved results" tone="emerald" />
        <MetricCard label="Pending" value={overview.pendingResults} helper="Awaiting review" tone="amber" />
        <MetricCard label="Rejected" value={overview.rejectedResults} helper="Needs correction" tone="red" />
        <MetricCard label="Villages Covered" value={overview.totalVillagesCovered} helper="Villages in result data" tone="slate" />
        <MetricCard label="Avg Performance" value={`${overview.averagePerformance || 0}%`} helper="Normalized score average" tone="indigo" />
        <MetricCard label="Govt Qualified" value={overview.governmentExamQualifiedStudents} helper="Approved exam qualifiers" tone="emerald" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <HorizontalBarChart
          title="Village Performance Analysis"
          subtitle="Average normalized score by village"
          data={analytics.villagePerformance || []}
        />
        <DonutChart
          title="Category Distribution"
          subtitle="Where students are submitting results"
          data={analytics.categoryDistribution || []}
          centerLabel="Results"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <HorizontalBarChart
          title="Education-wise Performance"
          subtitle="Average score by education level"
          data={analytics.educationPerformance || []}
        />
        <DonutChart
          title="Result Approval Analytics"
          subtitle="Current review workload and outcomes"
          data={analytics.approvalAnalytics || []}
          centerLabel="Results"
        />
      </div>

      <div className="mt-6">
        <CategoryScoreboard
          scoreboards={analytics.categoryScoreboards || []}
          onView={openFileViewer}
          formatScore={formatResultScore}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <CountListCard
          title="Government Exam Achievements"
          subtitle="Qualified students by exam"
          data={analytics.governmentExamAchievements || []}
        />
        <CountListCard
          title="College-wise Analytics"
          subtitle="Undergraduate and postgraduate student count"
          data={analytics.collegeAnalytics || []}
        />
        <CountListCard
          title="School-wise Analytics"
          subtitle="School student submissions"
          data={analytics.schoolAnalytics || []}
        />
      </div>

      <div className="mt-6">
        <AchievementFeed achievements={analytics.recentAchievements || []} onView={openFileViewer} />
      </div>

      <FileViewerModal
        isOpen={fileViewer.open}
        file={fileViewer.file}
        onClose={closeFileViewer}
      />
    </div>
  );
};

export default Analytics;