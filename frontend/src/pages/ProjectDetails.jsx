import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { projectsAPI, tasksAPI } from "../services/api";
import MetricCard from "../components/MetricCard";
import HealthBadge from "../components/HealthBadge";
import {
  CheckSquare, Clock, AlertTriangle, GitBranch, FileAudio,
  BarChart3, Calendar, Users, Layers, ExternalLink, Trash2,
  Plus, Edit2, X, Loader2, Folder, User, FileText, Activity, Zap
} from "lucide-react";

const STATUS_CLASSES = {
  completed:   "badge-good",
  in_progress: "badge-info",
  pending:     "badge bg-slate-100 text-slate-700 border border-slate-300",
  blocked:     "badge-danger",
};

const PRIORITY_DOT = {
  High:   "bg-rose-500",
  Medium: "bg-amber-500",
  Low:    "bg-emerald-500",
};


export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tasks");

  // Edit Project Modal state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: "",
    client_name: "",
    description: "",
    team_members: "",
    start_date: "",
    end_date: "",
    health: "good",
  });
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectError, setProjectError] = useState("");

  // Task Modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    module: "",
    priority: "Medium",
    status: "pending",
    estimated_hours: 0,
  });
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState("");

  const fetchProjectData = async () => {
    try {
      const res = await projectsAPI.get(id);
      setProject(res.data);
    } catch (err) {
      console.error("Failed to load project details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const handleDeleteProject = async () => {
    if (!window.confirm(`Are you sure you want to delete "${project?.name}"? This action cannot be undone.`)) return;
    try {
      await projectsAPI.delete(id);
      navigate("/projects");
    } catch (err) {
      alert("Failed to delete project: " + (err.response?.data?.detail || err.message));
    }
  };

  // ── Edit Project Handlers ────────────────────────────────────────────────
  const openEditProjectModal = () => {
    setProjectForm({
      name: project?.name || "",
      client_name: project?.client_name || "",
      description: project?.description || "",
      team_members: Array.isArray(project?.team_members) ? project.team_members.join(", ") : "",
      start_date: project?.start_date || "",
      end_date: project?.end_date || "",
      health: project?.health || "good",
    });
    setProjectError("");
    setShowEditProjectModal(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!projectForm.name.trim()) {
      setProjectError("Project name is required.");
      return;
    }
    setProjectSaving(true);
    setProjectError("");

    const membersArray = projectForm.team_members
      ? projectForm.team_members.split(",").map((m) => m.trim()).filter(Boolean)
      : [];

    const payload = {
      name: projectForm.name,
      client_name: projectForm.client_name,
      description: projectForm.description,
      team_members: membersArray,
      start_date: projectForm.start_date,
      end_date: projectForm.end_date,
      health: projectForm.health,
    };

    try {
      await projectsAPI.update(id, payload);
      setShowEditProjectModal(false);
      await fetchProjectData();
    } catch (err) {
      setProjectError(err.response?.data?.detail || "Failed to update project.");
    } finally {
      setProjectSaving(false);
    }
  };

  // ── Task Modal Handlers ───────────────────────────────────────────────────
  const openAddTaskModal = () => {
    setEditingTask(null);
    setTaskForm({
      title: "",
      description: "",
      module: project?.modules?.[0]?.name || "",
      priority: "Medium",
      status: "pending",
      estimated_hours: 0,
    });
    setTaskError("");
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title || "",
      description: task.description || "",
      module: task.module || "",
      priority: task.priority || "Medium",
      status: task.status || "pending",
      estimated_hours: task.estimated_hours || 0,
    });
    setTaskError("");
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      setTaskError("Task title is required.");
      return;
    }
    setTaskSaving(true);
    setTaskError("");
    try {
      if (editingTask) {
        const taskId = editingTask.id || editingTask._id;
        await tasksAPI.update(taskId, taskForm);
      } else {
        await tasksAPI.create(id, taskForm);
      }
      setShowTaskModal(false);
      await fetchProjectData();
    } catch (err) {
      setTaskError(err.response?.data?.detail || "Failed to save task.");
    } finally {
      setTaskSaving(false);
    }
  };

  const handleDeleteTask = async (task) => {
    const taskId = task.id || task._id;
    if (!window.confirm(`Are you sure you want to delete task "${task.title}"?`)) return;
    try {
      await tasksAPI.delete(taskId);
      await fetchProjectData();
    } catch (err) {
      alert("Failed to delete task: " + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="skeleton h-36 rounded-2xl" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );

  if (!project) return (
    <div className="text-center text-slate-500 pt-20 font-bold">Project not found.</div>
  );

  const tasks = project.tasks || [];
  const done = tasks.filter(t => t.status === "completed").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;

  const tabs = ["tasks", "meetings", "modules"];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Main Header Card */}
      <div className="glass-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{project.name}</h1>
              <HealthBadge health={project.health} />
            </div>
            <p className="text-slate-500 text-sm font-medium">{project.client_name} • {project.description?.slice(0, 120)}...</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={openEditProjectModal}
              className="btn-secondary flex items-center gap-2 py-2 px-3 text-xs font-semibold"
            >
              <Edit2 size={15} /> Edit Project
            </button>
            <Link to={`/projects/${id}/meetings`} className="btn-secondary flex items-center gap-2 py-2 px-3.5 text-xs font-semibold">
              <FileAudio size={15} /> Upload Meeting
            </Link>
            <Link to={`/projects/${id}/github`} className="btn-secondary flex items-center gap-2 py-2 px-3.5 text-xs font-semibold">
              <GitBranch size={15} /> GitHub Sync
            </Link>
            <Link to={`/projects/${id}/summary`} className="btn-primary flex items-center gap-2 py-2 px-3.5 text-xs font-semibold">
              <BarChart3 size={15} /> Summary
            </Link>
            <button
              onClick={handleDeleteProject}
              title="Delete Project"
              className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
            <span className="uppercase tracking-wide">Overall Progress</span>
            <span>{project.progress || 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-2 rounded-full bg-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, project.progress || 0))}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4 text-xs font-medium text-slate-500 border-t border-slate-100 pt-4 flex-wrap">
          <span className="flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {project.team_members?.length || 0} members</span>
          <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> {project.start_date} → {project.end_date}</span>
          {project.github_repo_url && (
            <a href={project.github_repo_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 transition-colors font-semibold">
              <GitBranch size={14} /> Repository <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={CheckSquare}   label="Completed"   value={done}       color="emerald" />
        <MetricCard icon={Clock}         label="In Progress" value={inProgress}  color="primary" />
        <MetricCard icon={AlertTriangle} label="Blocked"     value={blocked}     color="rose"    />
        <MetricCard icon={Layers}        label="Modules"     value={project.modules?.length || 0} color="primary" />
      </div>

      {/* Active Blockers Banner — Rose Tint Box */}
      {project.blockers?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 mb-6 border-rose-200 bg-rose-50 relative overflow-hidden"
        >
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
          <p className="text-sm font-bold text-rose-700 mb-2 flex items-center gap-2 pl-1">
            <AlertTriangle size={16} /> Active Blockers ({project.blockers.length})
          </p>
          <ul className="space-y-1">
            {project.blockers.map((b, i) => (
              <li key={i} className="text-sm text-slate-800 font-semibold flex items-start gap-2">
                <span className="text-rose-600 mt-0.5">•</span> {b}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Tabs Header & Task Actions */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit border border-slate-200">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 capitalize
                ${activeTab === tab
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"}`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "tasks" && (
          <button
            onClick={openAddTaskModal}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-xs font-black"
          >
            <Plus size={16} /> Add New Task
          </button>
        )}
      </div>

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="glass-card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Task</th>
                  <th className="px-5 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Module</th>
                  <th className="px-5 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Priority</th>
                  <th className="px-5 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wide">Est. Hours</th>
                  <th className="px-5 py-3 text-right text-xs text-slate-500 font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500 font-semibold">
                      No tasks created yet. Click "Add New Task" to create one.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task, i) => (
                    <motion.tr
                      key={task.id || task._id || i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-slate-900 font-semibold">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 font-medium">{task.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 text-xs font-bold">{task.module || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 text-xs text-slate-800 font-extrabold">
                          <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority] || "bg-slate-400"}`} />
                          {task.priority || "Medium"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={STATUS_CLASSES[task.status] || "badge badge-info"}>
                          {task.status?.replace("_", " ") || "pending"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 text-xs font-bold">
                        {task.estimated_hours ? `${task.estimated_hours}h` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditTaskModal(task)}
                            title="Edit Task"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-all border border-slate-200"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task)}
                            title="Delete Task"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all border border-rose-200"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Meetings Tab */}
      {activeTab === "meetings" && (
        <div className="space-y-4">
          {(project.meetings || []).length === 0 ? (
            <div className="glass-card p-12 text-center">
              <span className="w-14 h-14 rounded-xl bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center mx-auto mb-3">
                <FileAudio size={26} className="text-indigo-600" />
              </span>
              <p className="text-slate-900 font-bold mb-4">No meeting transcripts uploaded yet.</p>
              <Link to={`/projects/${id}/meetings`} className="btn-primary inline-flex items-center gap-2">
                Upload Transcript
              </Link>
            </div>
          ) : (
            project.meetings.map((m, i) => (
              <div key={i} className="glass-card p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-slate-900">{m.filename || "Meeting Transcript"}</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{m.date?.slice(0, 10)}</p>
                  </div>
                </div>
                {m.summary && <p className="text-sm text-slate-600 mb-3 font-normal">{m.summary}</p>}
                {m.decisions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Decisions</p>
                    <ul className="space-y-1">
                      {m.decisions.map((d, di) => (
                        <li key={di} className="text-xs text-slate-800 flex gap-2 font-semibold">
                          <span className="text-indigo-600">•</span> {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modules Tab */}
      {activeTab === "modules" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {(project.modules || []).length === 0 ? (
            <div className="glass-card p-12 text-center col-span-2">
              <span className="w-14 h-14 rounded-xl bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center mx-auto mb-3">
                <Layers size={26} className="text-indigo-600" />
              </span>
              <p className="text-slate-900 font-bold">No modules generated yet.</p>
            </div>
          ) : (
            project.modules.map((mod, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card card-interactive p-5">
                <div className="flex items-start justify-between mb-2 gap-3">
                  <h3 className="font-bold text-slate-900">{mod.name}</h3>
                  <span className={`badge text-xs flex-shrink-0 ${mod.priority === "High" ? "badge-danger" : mod.priority === "Medium" ? "badge-warning" : "badge-good"}`}>
                    {mod.priority}
                  </span>
                </div>
                <p className="text-sm text-slate-600 font-normal">{mod.description}</p>
                <p className="text-xs font-semibold mt-3 text-indigo-600">
                  {tasks.filter(t => t.module === mod.name).length} tasks linked
                </p>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Edit Project Modal */}
      <AnimatePresence>
        {showEditProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 w-full max-w-lg relative text-slate-900"
            >
              <button
                onClick={() => setShowEditProjectModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Edit Project Details</h2>
                  <p className="text-xs text-slate-500 font-medium">Update project info, team members, or timeline</p>
                </div>
              </div>

              {projectError && (
                <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3.5 rounded-xl font-semibold">
                  {projectError}
                </div>
              )}

              <form onSubmit={handleSaveProject} className="space-y-4 text-left">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <Folder size={13} className="text-indigo-600" /> Project Name *
                  </label>
                  <input
                    type="text"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <User size={13} className="text-indigo-600" /> Client Name
                  </label>
                  <input
                    type="text"
                    value={projectForm.client_name}
                    onChange={(e) => setProjectForm({ ...projectForm, client_name: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <FileText size={13} className="text-indigo-600" /> Description
                  </label>
                  <textarea
                    rows={3}
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <Users size={13} className="text-indigo-600" /> Team Members (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Akhil, Bhuvan, Rahul"
                    value={projectForm.team_members}
                    onChange={(e) => setProjectForm({ ...projectForm, team_members: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      <Calendar size={13} className="text-indigo-600" /> Start Date
                    </label>
                    <input
                      type="date"
                      value={projectForm.start_date}
                      onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                      className="input-field [color-scheme:light]"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      <Calendar size={13} className="text-indigo-600" /> End Date / Timeline
                    </label>
                    <input
                      type="date"
                      value={projectForm.end_date}
                      onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
                      className="input-field [color-scheme:light]"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <Activity size={13} className="text-indigo-600" /> Health Status
                  </label>
                  <select
                    value={projectForm.health}
                    onChange={(e) => setProjectForm({ ...projectForm, health: e.target.value })}
                    className="input-field [color-scheme:light]"
                  >
                    <option value="good">Healthy (Good)</option>
                    <option value="needs_attention">Needs Attention</option>
                    <option value="at_risk">At Risk</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEditProjectModal(false)}
                    className="btn-secondary py-2.5 px-4 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={projectSaving}
                    className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2"
                  >
                    {projectSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Modal (Add / Edit) */}
      <AnimatePresence>
        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 w-full max-w-lg relative text-slate-900"
            >
              <button
                onClick={() => setShowTaskModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                  {editingTask ? <Edit2 size={20} /> : <Plus size={20} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {editingTask ? "Edit Task" : "Add New Task"}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {editingTask ? "Update task parameters and status" : "Create a new action item for this project"}
                  </p>
                </div>
              </div>

              {taskError && (
                <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3.5 rounded-xl font-semibold">
                  {taskError}
                </div>
              )}

              <form onSubmit={handleSaveTask} className="space-y-4 text-left">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <CheckSquare size={13} className="text-indigo-600" /> Task Title *
                  </label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="e.g. Implement user login endpoint"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <FileText size={13} className="text-indigo-600" /> Description
                  </label>
                  <textarea
                    rows={2}
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="Provide details about the task"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      <Layers size={13} className="text-indigo-600" /> Module
                    </label>
                    <input
                      type="text"
                      list="modules-list"
                      value={taskForm.module}
                      onChange={(e) => setTaskForm({ ...taskForm, module: e.target.value })}
                      placeholder="Select or enter module"
                      className="input-field"
                    />
                    <datalist id="modules-list">
                      {(project.modules || []).map((m, idx) => (
                        <option key={idx} value={m.name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      <Zap size={13} className="text-indigo-600" /> Priority
                    </label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      className="input-field [color-scheme:light]"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      <Activity size={13} className="text-indigo-600" /> Status
                    </label>
                    <select
                      value={taskForm.status}
                      onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                      className="input-field [color-scheme:light]"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      <Clock size={13} className="text-indigo-600" /> Estimated Hours
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={taskForm.estimated_hours}
                      onChange={(e) => setTaskForm({ ...taskForm, estimated_hours: parseInt(e.target.value) || 0 })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTaskModal(false)}
                    className="btn-secondary py-2.5 px-4 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={taskSaving}
                    className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2"
                  >
                    {taskSaving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Task"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
