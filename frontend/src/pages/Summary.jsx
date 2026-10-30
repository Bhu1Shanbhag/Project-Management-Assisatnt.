import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { summaryAPI } from "../services/api";
import HealthBadge from "../components/HealthBadge";
import ProgressBar from "../components/ProgressBar";
import {
  BarChart3, Loader2, Calendar, Zap, TrendingUp, ClipboardList, Heart, FileText,
} from "lucide-react";

const SUMMARY_TYPES = [
  { key: "daily",     label: "Daily",     icon: Calendar,      desc: "What happened today",      chip: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"   },
  { key: "weekly",    label: "Weekly",    icon: TrendingUp,    desc: "This week's progress",     chip: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100" },
  { key: "sprint",    label: "Sprint",    icon: Zap,           desc: "Sprint review & velocity", chip: "bg-amber-50 text-amber-600 ring-1 ring-amber-100"      },
  { key: "executive", label: "Executive", icon: ClipboardList, desc: "High-level business view", chip: "bg-sky-50 text-sky-600 ring-1 ring-sky-100"            },
  { key: "health",    label: "Health",    icon: Heart,         desc: "Project risk & RAG status", chip: "bg-rose-50 text-rose-600 ring-1 ring-rose-100"        },
];

export default function Summary() {
  const { id: projectId } = useParams();
  const [summaryType, setSummaryType] = useState("daily");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setSummary(null);
    try {
      const res = await summaryAPI.get(projectId, summaryType);
      setSummary(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to generate summary.");
    } finally {
      setLoading(false);
    }
  };

  const selectedType = SUMMARY_TYPES.find(t => t.key === summaryType);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <BarChart3 size={26} className="text-indigo-600" /> AI Executive Summary
        </h1>
        <p className="page-subtitle">Generate comprehensive AI-powered project status reports</p>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {SUMMARY_TYPES.map(({ key, label, icon: Icon, desc, chip }) => (
          <button
            key={key}
            id={`summary-type-${key}`}
            onClick={() => setSummaryType(key)}
            className={`glass-card card-interactive p-4 text-left
              ${summaryType === key ? "border-indigo-500 ring-2 ring-indigo-500/15" : ""}`}
          >
            <span className={`w-9 h-9 rounded-lg mb-2.5 flex items-center justify-center ${chip}`}>
              <Icon size={17} />
            </span>
            <p className="text-sm font-bold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      {/* Generate button */}
      <button
        id="generate-summary-btn"
        onClick={handleGenerate}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2 mb-6 py-3.5 text-sm font-extrabold"
      >
        {loading ? (
          <><Loader2 size={18} className="animate-spin" /> Generating {summaryType} summary with AI...</>
        ) : (
          <><FileText size={18} /> Generate {selectedType?.label} Summary</>
        )}
      </button>

      {error && (
        <p className="text-rose-700 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-5 font-bold">
          {error}
        </p>
      )}

      {/* Summary result */}
      <AnimatePresence>
        {summary && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Header */}
            <div className="glass-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white">
              <div>
                <h2 className="text-xl font-black text-slate-900">{summary.project_name}</h2>
                <p className="text-sm font-semibold text-slate-500 mt-0.5">
                  {selectedType?.label} Report · Generated {summary.generated_at?.slice(0, 10)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <HealthBadge health={summary.health} />
                <span className="badge badge-info text-xs">{summary.progress}% Complete</span>
              </div>
            </div>

            {/* Metrics bar */}
            {summary.metrics && (
              <div className="glass-card p-5 bg-white">
                <h3 className="section-heading">Task Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: "Total Tasks",  value: summary.metrics.total,       cls: "bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-500/25" },
                    { label: "Completed",    value: summary.metrics.completed,   cls: "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/30" },
                    { label: "In Progress",  value: summary.metrics.in_progress, cls: "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30" },
                    { label: "Blocked",      value: summary.metrics.blocked,     cls: "bg-gradient-to-br from-rose-400 to-pink-600 shadow-rose-500/30" },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className={`text-center p-3 rounded-xl text-white shadow-lg ${cls}`}>
                      <p className="text-2xl font-black">{value}</p>
                      <p className="text-[11px] font-black text-white/80 uppercase tracking-wider mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <ProgressBar value={summary.metrics.completion_rate} color="emerald" />
                <p className="text-xs font-bold text-slate-600 mt-2 text-right">{summary.metrics.completion_rate}% completion rate</p>
              </div>
            )}

            {/* Blockers */}
            {summary.blockers?.length > 0 && (
              <div className="glass-card p-5 border-rose-200 bg-rose-50">
                <h3 className="section-heading text-rose-700">Active Blockers</h3>
                <ul className="space-y-2">
                  {summary.blockers.map((b, i) => (
                    <li key={i} className="text-sm font-semibold text-slate-800 flex gap-2">
                      <span className="text-rose-600 mt-0.5">▲</span> {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI Content */}
            <div className="glass-card p-6 bg-white">
              <h3 className="section-heading">
                <BarChart3 size={18} className="text-indigo-600" /> AI Generated Report
              </h3>
              <div className="prose prose-sm max-w-none text-slate-800">
                {summary.content?.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-black text-slate-900 mt-5 mb-2 border-b border-slate-100 pb-1">{line.slice(3)}</h2>;
                  if (line.startsWith("### ")) return <h3 key={i} className="text-base font-extrabold text-slate-900 mt-4 mb-1.5">{line.slice(4)}</h3>;
                  if (line.startsWith("- ") || line.startsWith("* ")) return (
                    <li key={i} className="text-sm font-semibold text-slate-700 ml-4 list-disc">{line.slice(2)}</li>
                  );
                  if (line.startsWith("**") && line.endsWith("**")) return (
                    <p key={i} className="font-extrabold text-slate-900 mt-2">{line.slice(2, -2)}</p>
                  );
                  if (!line.trim()) return <br key={i} />;
                  return <p key={i} className="text-sm font-medium text-slate-700 leading-relaxed mb-2">{line}</p>;
                })}
              </div>
            </div>

            {/* Latest decisions */}
            {summary.latest_decisions?.length > 0 && (
              <div className="glass-card p-5 bg-white">
                <h3 className="section-heading">Recent Decisions</h3>
                <ul className="space-y-2">
                  {summary.latest_decisions.map((d, i) => (
                    <li key={i} className="text-sm font-semibold text-slate-800 flex gap-2">
                      <span className="text-indigo-600 font-bold">→</span> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
