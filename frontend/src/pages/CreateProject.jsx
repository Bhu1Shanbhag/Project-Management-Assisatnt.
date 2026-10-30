import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { projectsAPI } from "../services/api";
import {
  Loader2, Plus, Minus, Upload, ChevronRight, ChevronLeft, Sparkles
} from "lucide-react";

const STEPS = ["Project Info", "Team & Dates", "GitHub", "Documents"];

export default function CreateProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    description: "",
    team_members: [""],
    start_date: "",
    end_date: "",
    github_repo_url: "",
    github_pat: "",
  });
  const [reqDoc, setReqDoc] = useState(null);

  const update = (field, val) => setForm((f) => ({ ...f, [field]: val }));
  const updateMember = (i, val) => {
    const arr = [...form.team_members];
    arr[i] = val;
    update("team_members", arr);
  };
  const addMember = () => update("team_members", [...form.team_members, ""]);
  const removeMember = (i) => {
    const arr = form.team_members.filter((_, idx) => idx !== i);
    update("team_members", arr.length ? arr : [""]);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...form,
        team_members: form.team_members.filter(Boolean),
      };
      const res = await projectsAPI.create(payload);
      const projectId = res.data?.project_id || res.data?.id || res.data?._id;

      // Upload requirements doc if provided
      if (reqDoc && projectId) {
        const fd = new FormData();
        fd.append("file", reqDoc);
        fd.append("doc_type", "requirements");
        await projectsAPI.uploadDocument(projectId, fd);
      }

      if (projectId) {
        navigate(`/projects/${projectId}`);
      } else {
        navigate("/projects");
      }

    } catch (err) {
      let msg = "Failed to create project.";
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-5">
            <div>
              <label className="form-label">Project Name *</label>
              <input id="project-name" type="text" placeholder="e.g., E-Commerce Platform v2"
                value={form.name} onChange={e => update("name", e.target.value)}
                className="input-field" required />
            </div>
            <div>
              <label className="form-label">Client Name *</label>
              <input id="client-name" type="text" placeholder="e.g., Acme Corp"
                value={form.client_name} onChange={e => update("client_name", e.target.value)}
                className="input-field" required />
            </div>
            <div>
              <label className="form-label">Project Description *</label>
              <textarea id="project-desc" rows={4}
                placeholder="Describe the project goals, scope, and key features. The AI will use this to generate modules and tasks."
                value={form.description} onChange={e => update("description", e.target.value)}
                className="input-field resize-none" required />
              <p className="text-xs text-slate-500 font-medium mt-1.5">
                💡 The more detail you provide, the better the AI-generated task breakdown.
              </p>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <label className="form-label">Team Members</label>
              <div className="space-y-2">
                {form.team_members.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Team member ${i + 1} name`}
                      value={m}
                      onChange={e => updateMember(i, e.target.value)}
                      className="input-field"
                    />
                    {form.team_members.length > 1 && (
                      <button type="button" onClick={() => removeMember(i)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors">
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addMember}
                className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <Plus size={14} /> Add another member
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Start Date</label>
                <input type="date" value={form.start_date}
                  onChange={e => update("start_date", e.target.value)}
                  className="input-field [color-scheme:light]" />
              </div>
              <div>
                <label className="form-label">Target End Date</label>
                <input type="date" value={form.end_date}
                  onChange={e => update("end_date", e.target.value)}
                  className="input-field [color-scheme:light]" />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <label className="form-label">GitHub Repository URL (Optional)</label>
              <input type="url" placeholder="https://github.com/owner/repo"
                value={form.github_repo_url} onChange={e => update("github_repo_url", e.target.value)}
                className="input-field" />
              <p className="text-xs text-slate-500 font-medium mt-1">Connect your repo to automatically sync PRs and commits with project tasks.</p>
            </div>
            <div>
              <label className="form-label">Personal Access Token (PAT)</label>
              <input type="password" placeholder="ghp_xxxxxxxxxxxx"
                value={form.github_pat} onChange={e => update("github_pat", e.target.value)}
                className="input-field" />
              <p className="text-xs text-slate-500 font-medium mt-1">Required for private repositories. Needs repo scope.</p>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <label className="form-label">Requirements Document (Optional)</label>
              <label
                htmlFor="req-doc"
                className="flex flex-col items-center justify-center w-full h-40
                           border-2 border-dashed border-slate-300 rounded-xl cursor-pointer
                           hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50 transition-colors"
              >
                <Upload size={28} className={`mb-2 ${reqDoc ? "text-emerald-600" : "text-slate-400"}`} />
                <p className="text-sm font-semibold text-slate-700">
                  {reqDoc ? reqDoc.name : "Click to upload or drag & drop"}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">PDF, DOCX, TXT (max 10MB)</p>
                <input id="req-doc" type="file" accept=".pdf,.docx,.txt" className="hidden"
                  onChange={e => setReqDoc(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="glass-card p-5 border-indigo-200 bg-indigo-50">
              <p className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-1.5">
                <Sparkles size={16} className="text-indigo-600" /> AI will automatically:
              </p>
              <ul className="text-xs text-indigo-800 font-medium space-y-1">
                <li>• Analyze your project description and requirements document</li>
                <li>• Generate project modules and technical feature breakdown</li>
                <li>• Create an initial task list with priorities and estimated hours</li>
                <li>• Build a searchable RAG knowledge base for AI Chat</li>
              </ul>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Create New Project</h1>
        <p className="page-subtitle">AI will analyze your project and generate an intelligent task breakdown</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${i < step
                  ? "bg-emerald-600 text-white"
                  : i === step
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-500 border border-slate-200"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${i === step ? "text-slate-900" : i < step ? "text-emerald-600" : "text-slate-500"}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full ${i < step ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="glass-card p-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-lg font-extrabold text-slate-900 mb-6">{STEPS[step]}</h2>
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="mt-4 text-rose-700 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 font-semibold">
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="btn-secondary flex items-center gap-2 py-2.5 px-5 text-sm disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && (!form.name || !form.description)}
              className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              id="create-project-btn"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary flex items-center gap-2 py-2.5 px-6 text-sm"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : "🚀 Create Project"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
