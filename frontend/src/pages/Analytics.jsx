import { useState, useEffect } from "react";
import api from "../services/api";
import { PageLoader } from "../components/ui";

const MEDALS = ["🥇", "🥈", "🥉"];
const COLORS = [
  "from-yellow-400 to-amber-500",
  "from-gray-300 to-gray-400",
  "from-amber-600 to-amber-700",
];
const CARD_SIZES = ["scale-105 z-10", "scale-100", "scale-95 opacity-90"];

const Analytics = () => {
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/results/top")
      .then((res) => setTop(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="text-3xl font-bold text-gray-900">Top Performers</h1>
        <p className="text-gray-500 mt-2">Highest approved results on the platform</p>
      </div>

      {top.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-900">No approved results yet</h3>
          <p className="text-gray-500 text-sm mt-2">Top performers will appear here once results are approved.</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="flex items-end justify-center gap-4 mb-12">
            {/* Reorder to show 2nd, 1st, 3rd for podium effect */}
            {[top[1], top[0], top[2]].map((student, podiumIndex) => {
              if (!student) return <div key={podiumIndex} className="w-40" />;
              const rank = podiumIndex === 1 ? 0 : podiumIndex === 0 ? 1 : 2;
              const heights = ["h-32", "h-44", "h-24"];
              const podiumHeight = podiumIndex === 1 ? heights[0] : podiumIndex === 0 ? heights[1] : heights[2];

              return (
                <div key={student._id} className={`flex flex-col items-center ${podiumIndex === 1 ? CARD_SIZES[0] : ""}`}>
                  <div className="text-4xl mb-2">{MEDALS[rank]}</div>
                  <div className="card p-4 w-40 text-center shadow-md mb-0">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-indigo-700 font-bold text-xl">
                        {student.studentName[0].toUpperCase()}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm truncate">{student.studentName}</p>
                    <p className="text-xs text-gray-500 truncate">{student.village || "—"}</p>
                    <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${COLORS[rank]} bg-clip-text text-transparent`}>
                      {student.percentage}%
                    </p>
                  </div>
                  <div className={`${podiumHeight} w-40 bg-gradient-to-b ${COLORS[rank]} rounded-b-lg flex items-center justify-center`}>
                    <span className="text-white font-bold text-2xl">#{rank + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed cards */}
          <div className="space-y-4">
            {top.map((student, i) => (
              <div key={student._id} className="card p-6 flex items-center gap-6 hover:shadow-md transition-shadow">
                <div className="text-3xl w-10 text-center">{MEDALS[i]}</div>
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-700 font-bold text-lg">
                    {student.studentName[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{student.studentName}</p>
                  <div className="flex gap-4 text-xs text-gray-500 mt-1 flex-wrap">
                    {student.village && <span>📍 {student.village}</span>}
                    {student.subject && <span>📚 {student.subject}</span>}
                    {student.examYear && <span>📅 {student.examYear}</span>}
                    {student.grade && <span>🎓 {student.grade}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-3xl font-bold bg-gradient-to-r ${COLORS[i]} bg-clip-text text-transparent`}>
                    {student.percentage}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(student.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <a
                  href={`/api/results/${student._id}/stream?token=${localStorage.getItem("token")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary btn-sm flex-shrink-0"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
