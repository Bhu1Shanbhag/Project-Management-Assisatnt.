import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { projectsAPI, githubAPI } from "../services/api";
import { GitBranch, RefreshCw, GitPullRequest, GitCommit, CheckCircle2, Loader2, Link2 } from "lucide-react";

export default function GitHubIntegration() {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [connectForm, setConnectForm] = useState({ repo_url: "", pat: "" });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    projectsAPI.get(projectId).then(r => {
      setProject(r.data);
      if (r.data?.github_repo_url) {
        setConnectForm(f => ({ ...f, repo_url: r.data.github_repo_url }));
      }
    }).catch(console.error);
  }, [projectId]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setConnecting(true);
    setError("");
    try {
      await githubAPI.connect({ project_id: projectId, ...connectForm });
      const r = await projectsAPI.get(projectId);
      setProject(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to connect to GitHub.");
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    setSyncResult(null);
    try {
      const res = await githubAPI.sync(projectId);
      setSyncResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Sync failed. Check your repository connection.");
    } finally {
      setSyncing(false);
    }
  };

  const connected = project?.github_connected || !!(project?.github_repo_url);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <GitBranch size={26} className="text-indigo-600" /> GitHub Integration
        </h1>
        <p className="page-subtitle">Connect your repository to track commits and pull requests</p>
      </div>

      {/* Status card */}
      <div className={`glass-card p-5 mb-6 flex items-center justify-between ${connected ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <div>
            <p className={`font-bold ${connected ? "text-emerald-700" : "text-amber-700"}`}>{connected ? "Connected" : "Not Connected"}</p>
            {connected && <p className="text-xs font-medium text-slate-500">{project.github_repo_url}</p>}
          </div>
        </div>
        {connected && (
          <button id="sync-btn" onClick={handleSync} disabled={syncing}
            className="btn-primary flex items-center gap-2 py-2 px-5 text-xs font-semibold">
            {syncing ? <><Loader2 size={15} className="animate-spin" /> Syncing...</> : <><RefreshCw size={15} /> Sync Now</>}
          </button>
        )}
      </div>

      {/* Connect form */}
      {!connected && (
        <div className="glass-card p-6 mb-6 bg-white">
          <h2 className="text-lg font-extrabold text-slate-900 mb-5">Connect Repository</h2>
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="form-label">Repository URL</label>
              <input id="repo-url" type="url" required placeholder="https://github.com/org/repo"
                value={connectForm.repo_url}
                onChange={e => setConnectForm(f => ({ ...f, repo_url: e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="form-label">Personal Access Token</label>
              <input id="gh-pat" type="password" required placeholder="ghp_..."
                value={connectForm.pat}
                onChange={e => setConnectForm(f => ({ ...f, pat: e.target.value }))}
                className="input-field" />
              <p className="text-xs text-slate-500 font-semibold mt-1.5">Required scopes: <code className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">repo</code>, <code className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono">read:org</code></p>
            </div>
            {error && <p className="text-rose-700 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 font-bold">{error}</p>}
            <button type="submit" disabled={connecting} className="btn-primary flex items-center gap-2 text-xs font-extrabold">
              {connecting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              {connecting ? "Connecting..." : "Connect Repository"}
            </button>
          </form>
        </div>
      )}

      {/* Sync results */}
      <AnimatePresence>
        {syncResult && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card card-interactive p-5 text-center">
                <span className="w-10 h-10 rounded-lg bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center mx-auto mb-2">
                  <GitCommit size={20} className="text-indigo-600" />
                </span>
                <p className="text-2xl font-bold text-slate-900">{syncResult.commits_fetched}</p>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-1">Commits Fetched</p>
              </div>
              <div className="glass-card card-interactive p-5 text-center">
                <span className="w-10 h-10 rounded-lg bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center mx-auto mb-2">
                  <GitPullRequest size={20} className="text-emerald-600" />
                </span>
                <p className="text-2xl font-bold text-slate-900">{syncResult.prs_fetched}</p>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mt-1">Pull Requests</p>
              </div>
            </div>

            {/* Commits */}
            {syncResult.github_data?.commits?.length > 0 && (
              <div className="glass-card p-5 bg-white">
                <h3 className="section-heading"><GitCommit size={18} className="text-indigo-600" /> Recent Commits</h3>
                <div className="space-y-3">
                  {syncResult.github_data.commits.slice(0, 10).map((c, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                      <code className="text-xs text-indigo-700 font-extrabold font-mono bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg flex-shrink-0">{c.sha}</code>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{c.message}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{c.author} · {c.date?.slice(0, 10)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PRs */}
            {syncResult.github_data?.pull_requests?.length > 0 && (
              <div className="glass-card p-5 bg-white">
                <h3 className="section-heading"><GitPullRequest size={18} className="text-emerald-600" /> Pull Requests</h3>
                <div className="space-y-3">
                  {syncResult.github_data.pull_requests.map((pr, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex-shrink-0 mt-0.5 ${pr.state === "open" ? "badge-good" : "badge-info"}`}>
                        {pr.state}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{pr.title}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{pr.author} · {pr.branch}</p>
                        {pr.matched_task_title && (
                          <p className="text-xs font-extrabold text-indigo-700 mt-1 flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-600" /> Matched: {pr.matched_task_title}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && !syncResult && (
        <p className="text-rose-700 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 font-bold">{error}</p>
      )}
    </div>
  );
}
