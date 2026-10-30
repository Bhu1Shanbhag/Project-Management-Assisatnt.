import { motion } from "framer-motion";

/**
 * MetricCard — a KPI tile: solid white card with a small colored icon chip.
 * Color is confined to the chip so a row of metrics stays clean and readable.
 */
export default function MetricCard({ icon: Icon, label, value, color = "primary", delta }) {
  const chipMap = {
    primary: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
    amber:   "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
    rose:    "bg-rose-50 text-rose-600 ring-1 ring-rose-100",
    sky:     "bg-sky-50 text-sky-600 ring-1 ring-sky-100",
    purple:  "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
    slate:   "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  };

  const chip = chipMap[color] || chipMap.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="glass-card card-interactive p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value ?? "—"}</p>
          {delta !== undefined && (
            <p className={`text-xs mt-1 font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% from last week
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${chip}`}>
          {Icon && <Icon size={19} />}
        </div>
      </div>
    </motion.div>
  );
}
