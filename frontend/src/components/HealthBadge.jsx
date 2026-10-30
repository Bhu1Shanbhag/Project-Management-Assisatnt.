/**
 * HealthBadge — displays project health status as a colored badge.
 * health: "good" | "needs_attention" | "at_risk"
 */
export default function HealthBadge({ health }) {
  const map = {
    good:             { label: "● Healthy",          cls: "badge-good" },
    needs_attention:  { label: "● Needs Attention",  cls: "badge-warning" },
    at_risk:          { label: "● At Risk",           cls: "badge-danger" },
  };

  const { label, cls } = map[health] || { label: "● Unknown", cls: "badge-info" };

  return <span className={cls}>{label}</span>;
}
