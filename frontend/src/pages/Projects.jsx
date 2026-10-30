import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { projectsAPI } from "../services/api";
import HealthBadge from "../components/HealthBadge";
import ProgressBar from "../components/ProgressBar";
import {
  FolderKanban, Plus, Search, Calendar, Users, ArrowRight, Trash2, Edit2, X, Loader2,
  Folder, User, FileText, Activity
} from "lucide-react";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    description: "",
    team_members: "",
    start_date: "",
    end_date: "",
    health: "good",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchProjects = async () => {
    try {
      const res = await projectsAPI.list();
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const openEditModal = (e, project) => {
    e.stopPropagation();
    e.preventDefault();
    const pId = project.id || project._id;
    setEditingProjectId(pId);
    setForm({
      name: project.name || "",
      client_name: project.client_name || "",
      description: project.description || "",
      team_members: Array.isArray(project.team_members) ? project.team_members.join(", ") : "",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      health: project.health || "good",
    });
    setError("");
    setShowEditModal(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }

    setSaving(true);
    setError("");

    const membersArray = form.team_members
      ? form.team_members.split(",").map((m) => m.trim()).filter(Boolean)
      : [];

    const payload = {
      name: form.name,
      client_name: form.client_name,
      description: form.description,
      team_members: membersArray,
      start_date: form.start_date,
      end_date: form.end_date,
      health: form.health,
    };

    try {
      await projectsAPI.update(editingProjectId, payload);
      setShowEditModal(false);
      await fetchProjects();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update project.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (e, id, name) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await projectsAPI.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id && p._id !== id));
    } catch (err) {
      alert("Failed to delete project: " + (err.response?.data?.detail || err.message));
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Projects Directory</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? "s" : ""} active in system</p>
        </div>
        <Link to="/projects/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Project
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id="project-search"
          type="text"
          placeholder="Search by project name or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* Projects Grid with Vibrant Color Themes */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <span className="w-14 h-14 rounded-xl bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center mx-auto mb-4">
            <FolderKanban size={26} className="text-indigo-600" />
          </span>
          <h3 className="text-base font-bold text-slate-900 mb-2">
            {search ? "No projects match your search" : "No projects yet"}
          </h3>
          {!search && (
            <Link to="/projects/new" className="btn-primary inline-flex items-center gap-2 mt-4">
              <Plus size={16} /> Create First Project
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project, i) => {
            const pId = project.id || project._id;
            return (
              <motion.div
                key={pId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card card-interactive p-5 flex flex-col gap-4"
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-slate-900 truncate">
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{project.client_name}</p>
                  </div>
                  <HealthBadge health={project.health} />
                </div>

                {/* Description */}
                <p className="text-sm text-slate-600 line-clamp-2 flex-1 font-normal">
                  {project.description || "No description provided."}
                </p>

                {/* Progress */}
                <ProgressBar value={project.progress || 0} size="sm" />

                {/* Meta */}
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Users size={14} className="text-slate-400" />
                    {project.team_members?.length || 0} members
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400" />
                    {project.end_date || "No deadline"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <Link
                    to={`/projects/${pId}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 transition-colors"
                  >
                    View Details <ArrowRight size={14} />
                  </Link>
                  <button
                    onClick={(e) => openEditModal(e, project)}
                    title="Edit Project"
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center justify-center"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteProject(e, pId, project.name)}
                    title="Delete Project"
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center justify-center"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit Project Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 w-full max-w-lg relative text-slate-900"
            >
              <button
                onClick={() => setShowEditModal(false)}
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
                  <p className="text-xs text-slate-500 font-medium">Update project parameters, team members, or timeline</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 p-3.5 rounded-xl font-semibold">
                  {error}
                </div>
              )}

              <form onSubmit={handleSaveProject} className="space-y-4 text-left">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <Folder size={13} className="text-indigo-600" /> Project Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <FileText size={13} className="text-indigo-600" /> Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                    value={form.team_members}
                    onChange={(e) => setForm({ ...form, team_members: e.target.value })}
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
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      className="input-field [color-scheme:light]"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                      <Calendar size={13} className="text-indigo-600" /> End Date / Timeline
                    </label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                      className="input-field [color-scheme:light]"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    <Activity size={13} className="text-indigo-600" /> Health Status
                  </label>
                  <select
                    value={form.health}
                    onChange={(e) => setForm({ ...form, health: e.target.value })}
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
                    onClick={() => setShowEditModal(false)}
                    className="btn-secondary py-2.5 px-4 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2"
                  >
                    {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Changes"}
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
