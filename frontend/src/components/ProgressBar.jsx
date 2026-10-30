/**
 * ProgressBar — a clean, single-tone progress bar with a percentage label.
 * Defaults to indigo; other tones are reserved for status contexts.
 */
export default function ProgressBar({ value = 0, color = "primary", showLabel = true, size = "md" }) {
  const colorMap = {
    primary: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber:   "bg-amber-500",
    rose:    "bg-rose-500",
    sky:     "bg-sky-500",
  };

  const heightMap = { sm: "h-1.5", md: "h-2", lg: "h-2.5" };

  const barColor = colorMap[color] || colorMap.primary;
  const height = heightMap[size] || heightMap.md;
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 bg-slate-100 rounded-full ${height} overflow-hidden`}>
        <div
          className={`${height} ${barColor} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-slate-600 w-9 text-right">
          {value}%
        </span>
      )}
    </div>
  );
}
