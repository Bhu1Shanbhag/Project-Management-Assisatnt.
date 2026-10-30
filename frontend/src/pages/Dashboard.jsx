import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { projectsAPI } from "../services/api";
import MetricCard from "../components/MetricCard";
import HealthBadge from "../components/HealthBadge";
import ProgressBar from "../components/ProgressBar";
import {
  FolderKanban, CheckSquare, AlertTriangle, Activity,
  TrendingUp, Plus, ArrowRight, Clock, Users, Sparkles, Layers
} from "lucide-react";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    projectsAPI.list()
      .then((res) => setProjects(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalTasks    = projects.reduce((s, p) => s + (p.tasks?.length || 0), 0);
  const totalComplete = projects.reduce((s, p) =>
    s + (p.tasks?.filter(t => t.status === "completed").length || 0), 0);
  const atRisk        = projects.filter(p => p.health === "at_risk").length;
  const avgProgress   = projects.length
    ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
    : 0;

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto"
    >
      {/* Welcome Banner — clean indigo, single accent */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-xl bg-indigo-600 text-white px-7 py-6 mb-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-indigo-200 text-[11px] font-semibold uppercase tracking-wider mb-2">
            <Sparkles size={14} /> Executive Overview
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Welcome back, {user.name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-indigo-100 text-sm font-medium">
            You have <strong className="text-white font-semibold">{projects.length} active project{projects.length !== 1 ? "s" : ""}</strong> with an average completion rate of <strong className="text-white font-semibold">{avgProgress}%</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 flex-shrink-0">
          <Link to="/projects/new" className="bg-white hover:bg-indigo-50 text-indigo-700 font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-colors flex items-center gap-2 text-sm">
            <Plus size={17} /> New Project
          </Link>
          <Link to="/chat" className="bg-indigo-500/60 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-lg border border-indigo-400/50 transition-colors flex items-center gap-2 text-sm">
            <Sparkles size={15} /> Ask AI
          </Link>
        </div>

        {/* Subtle depth — a single soft highlight, no rainbow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />
      </motion.div>

      {/* KPI Metric Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={FolderKanban}  label="Total Projects"  value={projects.length}  color="primary" />
        <MetricCard icon={CheckSquare}   label="Tasks Completed" value={totalComplete}     color="emerald" />
        <MetricCard icon={AlertTriangle} label="At Risk"         value={atRisk}            color="rose"    />
        <MetricCard icon={TrendingUp}    label="Avg Progress"    value={`${avgProgress}%`} color="primary" />
      </motion.div>

      {/* Projects Section */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-heading mb-0">
            <Activity size={18} className="text-indigo-600" />
            Active Projects
          </h2>
          <Link to="/projects" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-12 text-center"
          >
            <span className="w-14 h-14 rounded-xl bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center mx-auto mb-4">
              <FolderKanban size={26} className="text-indigo-600" />
            </span>
            <h3 className="text-base font-bold text-slate-900 mb-2">No projects yet</h3>
            <p className="text-slate-500 text-sm mb-6 font-medium">Create your first AI-powered project to get started.</p>
            <Link to="/projects/new" className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Create Project
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <motion.div
                key={project.id || project._id}
                variants={itemVariants}
                className="glass-card card-interactive p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 truncate">{project.name}</h3>
                      <HealthBadge health={project.health} />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                      <span>{project.client_name}</span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1"><Users size={14} className="text-slate-400" /> {project.team_members?.length || 0} members</span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1"><Layers size={14} className="text-slate-400" /> {project.modules?.length || 0} modules</span>
                    </p>
                  </div>
                  <Link
                    to={`/projects/${project.id || project._id}`}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    View Details <ArrowRight size={14} />
                  </Link>
                </div>

                <ProgressBar value={project.progress || 0} />

                <div className="flex items-center gap-5 text-xs font-semibold pt-3 border-t border-slate-100 flex-wrap">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <CheckSquare size={14} />
                    {project.tasks?.filter(t => t.status === "completed").length || 0} completed
                  </span>
                  <span className="flex items-center gap-1.5 text-indigo-600">
                    <Clock size={14} />
                    {project.tasks?.filter(t => t.status === "in_progress").length || 0} in progress
                  </span>
                  {(project.blockers?.length > 0) && (
                    <span className="flex items-center gap-1.5 text-rose-600">
                      <AlertTriangle size={14} />
                      {project.blockers.length} active blockers
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
