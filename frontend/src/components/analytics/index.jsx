import { useState, useMemo } from "react";

const CHART_COLORS = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0f766e", "#be123c"];

export const MetricCard = ({ label, value, helper, tone = "indigo" }) => {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tones[tone] || tones.indigo}`}>
        {label}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-950">{value}</p>
      {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
    </div>
  );
};

export const FilterPanel = ({ filters, options, onChange, onApply, onClear, loading }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <select className="input" value={filters.village} onChange={(e) => onChange("village", e.target.value)}>
        <option value="">All villages</option>
        {(options.villages || []).map((village) => (
          <option key={village} value={village}>{village}</option>
        ))}
      </select>

      <select className="input" value={filters.category} onChange={(e) => onChange("category", e.target.value)}>
        <option value="">All categories</option>
        {(options.categories || []).map((category) => (
          <option key={category} value={category}>{category}</option>
        ))}
      </select>

      <select className="input" value={filters.status} onChange={(e) => onChange("status", e.target.value)}>
        <option value="">All statuses</option>
        {(options.statuses || []).map((status) => (
          <option key={status} value={status}>{status}</option>
        ))}
      </select>

      <input
        className="input"
        list="analytics-institutions"
        placeholder="School or college"
        value={filters.institution}
        onChange={(e) => onChange("institution", e.target.value)}
      />
      <datalist id="analytics-institutions">
        {(options.institutions || []).map((institution) => (
          <option key={institution} value={institution} />
        ))}
      </datalist>

      <input className="input" type="date" value={filters.dateFrom} onChange={(e) => onChange("dateFrom", e.target.value)} />
      <input className="input" type="date" value={filters.dateTo} onChange={(e) => onChange("dateTo", e.target.value)} />
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className="btn-primary btn-sm" onClick={onApply} disabled={loading}>
        {loading ? "Applying..." : "Apply Filters"}
      </button>
      <button type="button" className="btn-secondary btn-sm" onClick={onClear} disabled={loading}>
        Clear
      </button>
    </div>
  </div>
);

export const HorizontalBarChart = ({ title, subtitle, data, valueKey = "avgScore", valueSuffix = "%", emptyText = "No data available" }) => {
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey]) || 0), 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="font-semibold text-gray-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="space-y-4">
          {data.map((item, index) => {
            const value = Number(item[valueKey]) || 0;
            return (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-gray-700">{item.label}</span>
                  <span className="shrink-0 font-semibold text-gray-950">
                    {value}{valueSuffix}
                    {item.count !== undefined && <span className="ml-1 text-xs font-normal text-gray-400">({item.count})</span>}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max((value / maxValue) * 100, 3)}%`,
                      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const DonutChart = ({ title, subtitle, data, centerLabel = "Total" }) => {
  let cursor = 0;
  const total = data.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  const gradient = total
    ? data
        .map((item, index) => {
          const start = cursor;
          cursor += (Number(item.count) / total) * 100;
          return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${cursor}%`;
        })
        .join(", ")
    : "#e5e7eb 0% 100%";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="font-semibold text-gray-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
        <div className="relative mx-auto h-44 w-44 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
          <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-2xl font-bold text-gray-950">{total}</span>
            <span className="text-xs text-gray-500">{centerLabel}</span>
          </div>
        </div>
        <div className="space-y-3">
          {data.length === 0 ? (
            <p className="text-sm text-gray-500">No data available</p>
          ) : (
            data.map((item, index) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="truncate text-gray-700">{item.label}</span>
                </span>
                <span className="shrink-0 font-semibold text-gray-950">
                  {item.percentage ?? 0}% <span className="text-xs font-normal text-gray-400">({item.count})</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const CountListCard = ({ title, subtitle, data, emptyText = "No data available" }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
    <div className="mb-4">
      <h2 className="font-semibold text-gray-950">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
    {data.length === 0 ? (
      <p className="py-8 text-center text-sm text-gray-500">{emptyText}</p>
    ) : (
      <div className="divide-y divide-gray-100">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-xs font-bold text-gray-600">
                {index + 1}
              </span>
              <span className="truncate text-sm font-medium text-gray-700">{item.label}</span>
            </div>
            <span className="rounded-md bg-indigo-50 px-2 py-1 text-sm font-semibold text-indigo-700">{item.count}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── CategoryScoreboard ────────────────────────────────────────────────────────
// Shows ALL students grouped by sub-category for whichever category the teacher selects.
export const CategoryScoreboard = ({ scoreboards, onView, formatScore }) => {
  const categoryLabels = useMemo(
    () => (scoreboards || []).map((b) => b.label),
    [scoreboards]
  );

  const [selectedCategory, setSelectedCategory] = useState(() => categoryLabels[0] || "");

  // Keep selection valid when scoreboards change
  const activeLabel = categoryLabels.includes(selectedCategory)
    ? selectedCategory
    : categoryLabels[0] || "";

  const activeBoard = useMemo(
    () => (scoreboards || []).find((b) => b.label === activeLabel) || null,
    [scoreboards, activeLabel]
  );

  // Group all students inside the selected category by subCategory
  const subCategoryGroups = useMemo(() => {
    if (!activeBoard) return [];
    const students = activeBoard.students || [];

    const map = new Map();
    for (const student of students) {
      // Derive sub-category label: prefer subCategory, then course, then stream, then "General"
      const sub =
        student.subCategory ||
        student.course ||
        student.stream ||
        "General";
      if (!map.has(sub)) map.set(sub, []);
      map.get(sub).push(student);
    }

    // Sort students inside each group by score descending
    const groups = [];
    for (const [label, members] of map) {
      groups.push({
        label,
        members: [...members].sort((a, b) => {
          const sa = Number(a.percentage ?? a.marks ?? 0);
          const sb = Number(b.percentage ?? b.marks ?? 0);
          return sb - sa;
        }),
      });
    }

    // Sort groups alphabetically
    return groups.sort((a, b) => a.label.localeCompare(b.label));
  }, [activeBoard]);

  const totalStudents = subCategoryGroups.reduce((s, g) => s + g.members.length, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header + category selector */}
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-950">Category-wise Scoreboard</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            All students grouped by sub-category
            {activeBoard && (
              <span className="ml-2 text-xs text-gray-400">
                — {totalStudents} student{totalStudents !== 1 ? "s" : ""}, avg {activeBoard.avgScore}%
              </span>
            )}
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1.5">
          {categoryLabels.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setSelectedCategory(label)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                label === activeLabel
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {!activeBoard || totalStudents === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">No student data for this category.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {subCategoryGroups.map((group) => (
            <div key={group.label}>
              {/* Sub-category header */}
              <div className="flex items-center justify-between bg-gray-50 px-5 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {group.label}
                </span>
                <span className="rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-500 shadow-sm border border-gray-200">
                  {group.members.length} student{group.members.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Student rows */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 text-left text-xs text-gray-400">
                    <tr>
                      <th className="px-5 py-2 font-medium w-8">#</th>
                      <th className="px-5 py-2 font-medium">Student</th>
                      <th className="px-5 py-2 font-medium">Village</th>
                      <th className="px-5 py-2 font-medium">Exam Year</th>
                      <th className="px-5 py-2 font-medium">Score</th>
                      <th className="px-5 py-2 font-medium">Status</th>
                      <th className="px-5 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.members.map((student, idx) => {
                      const score = Number(student.percentage ?? student.marks ?? 0);
                      const scoreColor =
                        score >= 75
                          ? "text-emerald-600"
                          : score >= 50
                          ? "text-amber-600"
                          : "text-red-500";

                      return (
                        <tr key={student.id || idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-xs font-bold text-gray-400">{idx + 1}</td>
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-900">{student.studentName}</p>
                          </td>
                          <td className="px-5 py-3 text-gray-500">{student.village || "—"}</td>
                          <td className="px-5 py-3 text-gray-500">{student.examYear || "—"}</td>
                          <td className="px-5 py-3">
                            <span className={`font-bold ${scoreColor}`}>{formatScore(student)}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              student.status === "approved"
                                ? "bg-emerald-50 text-emerald-700"
                                : student.status === "rejected"
                                ? "bg-red-50 text-red-600"
                                : student.status === "under_review"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-amber-50 text-amber-700"
                            }`}>
                              {student.status || "pending"}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {student.result && (
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() => onView(student.result)}
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AchievementFeed = ({ achievements, onView }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
    <div className="mb-4">
      <h2 className="font-semibold text-gray-950">Recent Achievements</h2>
      <p className="mt-1 text-sm text-gray-500">Latest approved accomplishments</p>
    </div>
    {achievements.length === 0 ? (
      <p className="py-8 text-center text-sm text-gray-500">No recent achievements yet.</p>
    ) : (
      <div className="space-y-3">
        {achievements.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onView(item.result)}
            className="flex w-full items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              OK
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-800">{item.text}</span>
              <span className="mt-1 block text-xs text-gray-500">
                {[item.village, item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN") : ""].filter(Boolean).join(" - ")}
              </span>
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
);