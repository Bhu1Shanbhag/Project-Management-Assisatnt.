import { useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { meetingsAPI } from "../services/api";
import {
  Upload, FileAudio, Loader2, CheckCircle2, AlertTriangle,
  FileText, Mic, ListChecks, ShieldAlert,
} from "lucide-react";

export default function MeetingUpload() {
  const { id: projectId } = useParams();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = (f) => {
    if (f && ["text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/pdf"].includes(f.type)) {
      setFile(f);
      setError("");
    } else {
      setError("Please upload a .txt, .docx or .pdf file.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("project_id", projectId);

    try {
      const res = await meetingsAPI.upload(fd);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to process transcript.");
    } finally {
      setLoading(false);
    }
  };

  const insights = result?.insights;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <Mic size={26} className="text-indigo-600" /> Upload Meeting Transcript
        </h1>
        <p className="page-subtitle">AI will extract tasks, blockers, decisions, and risks automatically</p>
      </div>

      {/* Dropzone */}
      {!result && (
        <div
          className={`glass-card p-10 text-center mb-6 transition-all border-2 border-dashed cursor-pointer rounded-2xl
            ${dragging
              ? "border-violet-500 bg-gradient-to-br from-indigo-100 to-violet-100"
              : "border-indigo-300 hover:border-violet-400 bg-gradient-to-br from-indigo-50/80 to-violet-50/80 hover:from-indigo-100/80 hover:to-violet-100/80"}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => document.getElementById("meeting-file").click()}
        >
          <input id="meeting-file" type="file" accept=".txt,.docx,.pdf" className="hidden"
            onChange={e => handleFile(e.target.files?.[0])} />

          {file ? (
            <>
              <FileText size={48} className="text-indigo-600 mx-auto mb-3" />
              <p className="font-extrabold text-slate-900 text-lg">{file.name}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/35 flex items-center justify-center mx-auto mb-3">
                <Mic size={30} className="text-white" />
              </span>
              <p className="text-xl font-black text-indigo-950">Drop your transcript here</p>
              <p className="text-sm font-semibold text-slate-600 mt-1">or click to browse from computer</p>
              <div className="flex items-center justify-center gap-3 mt-5">
                {[".TXT", ".DOCX", ".PDF"].map((ext, i) => (
                  <span key={ext} className={`badge text-xs ${["badge-info", "badge-good", "badge-warning"][i]}`}>{ext}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-rose-700 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4 font-bold">
          {error}
        </p>
      )}

      {!result && (
        <button id="upload-btn" onClick={handleUpload} disabled={!file || loading}
          className="btn-primary w-full flex items-center justify-center gap-2 mb-8 py-3.5 text-sm font-extrabold">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Analyzing transcript with AI...</> : "🤖 Process with AI"}
        </button>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Success header */}
            <div className="rounded-2xl p-5 flex items-center gap-4 text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 size={32} className="text-white flex-shrink-0" />
              <div>
                <p className="font-black text-base">Transcript Processed Successfully</p>
                <p className="text-sm font-bold text-white/85">
                  {result.insights?.new_tasks?.length || 0} new tasks • {" "}
                  {result.insights?.decisions?.length || 0} decisions • {" "}
                  {result.insights?.blockers?.length || 0} blockers identified
                </p>
              </div>
            </div>

            {/* Summary */}
            {insights?.summary && (
              <div className="glass-card p-5 bg-white">
                <h3 className="section-heading"><FileAudio size={18} className="text-indigo-600" /> Meeting Summary</h3>
                <p className="text-sm text-slate-800 font-medium leading-relaxed">{insights.summary}</p>
              </div>
            )}

            {/* New tasks */}
            {insights?.new_tasks?.length > 0 && (
              <div className="glass-card p-5 bg-white">
                <h3 className="section-heading"><ListChecks size={18} className="text-emerald-600" />
                  New Tasks Identified ({insights.new_tasks.length})
                </h3>
                <div className="space-y-3">
                  {insights.new_tasks.map((t, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex-shrink-0 mt-0.5
                        ${t.priority === "High" ? "badge-danger" :
                          t.priority === "Medium" ? "badge-warning" : "badge-good"}`}>
                        {t.priority}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{t.title}</p>
                        {t.description && <p className="text-xs font-semibold text-slate-500 mt-0.5">{t.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blockers */}
            {insights?.blockers?.length > 0 && (
              <div className="glass-card p-5 border-rose-200 bg-rose-50">
                <h3 className="section-heading text-rose-700"><ShieldAlert size={18} className="text-rose-600" />
                  Blockers ({insights.blockers.length})
                </h3>
                <ul className="space-y-2">
                  {insights.blockers.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-semibold text-slate-800">
                      <span className="text-rose-600 mt-0.5">▲</span> {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Decisions */}
            {insights?.decisions?.length > 0 && (
              <div className="glass-card p-5 bg-white">
                <h3 className="section-heading"><CheckCircle2 size={18} className="text-indigo-600" />
                  Decisions ({insights.decisions.length})
                </h3>
                <ul className="space-y-2">
                  {insights.decisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-semibold text-slate-800">
                      <span className="text-indigo-600 font-bold mt-0.5">→</span> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={() => { setResult(null); setFile(null); }}
              className="btn-secondary w-full text-xs font-extrabold py-3">Upload Another Transcript</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
