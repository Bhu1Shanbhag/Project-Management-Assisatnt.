import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { chatAPI, projectsAPI } from "../services/api";
import { Bot, Send, Loader2, User, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "What is the current sprint status?",
  "Which tasks are blocked?",
  "What were the key decisions in the last meeting?",
  "Which features are at risk of delay?",
  "Give me a summary of recent GitHub activity.",
];

export default function AIChat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your AI Project Intelligence assistant. I can answer questions about your projects, tasks, meetings, and requirements. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    projectsAPI.list().then(r => setProjects(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");

    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const res = await chatAPI.ask(q, selectedProject);
      setMessages(prev => [...prev, { role: "assistant", content: res.data.answer }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Sleek Monochrome Hero Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md mb-6 relative overflow-hidden flex items-center justify-between flex-shrink-0 gap-4 flex-wrap">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <Sparkles size={15} className="text-amber-400" /> Project Intelligence
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Bot size={26} className="text-slate-200" /> AI Chat Assistant
          </h1>
          <p className="text-slate-400 text-xs font-medium mt-1">Ask anything about your projects, meetings, and requirements</p>
        </div>

        {/* Project filter */}
        <select id="project-filter"
          value={selectedProject}
          onChange={e => setSelectedProject(e.target.value)}
          className="input-field text-xs py-2 min-w-44 relative z-10">
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="absolute -right-12 -bottom-16 w-56 h-56 bg-slate-800/40 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto glass-card p-6 mb-4 space-y-4 bg-white border border-slate-200 shadow-xs">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-sm
                ${msg.role === "assistant"
                  ? "bg-slate-800 border border-slate-700"
                  : "bg-slate-950 border border-slate-800"}`}>
                {msg.role === "assistant" ? <Sparkles size={14} className="text-slate-300" /> : <User size={14} className="text-slate-300" />}
              </div>

              {/* Bubble */}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                ${msg.role === "user"
                  ? "bg-slate-900 text-white rounded-tr-xs font-semibold shadow-sm"
                  : msg.isError
                    ? "bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-xs"
                    : "bg-slate-100 text-slate-800 border border-slate-200/90 rounded-tl-xs font-medium"
                }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-700">
              <Sparkles size={14} className="text-slate-300" />
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions — Clean Neutral Light Gray Pills */}
      {messages.length === 1 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              className="text-xs px-3.5 py-2 rounded-xl border border-slate-200/90 bg-slate-100/80 text-slate-700 hover:bg-slate-200 hover:border-slate-300 font-semibold transition-all shadow-2xs"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex gap-3 flex-shrink-0">
        <input
          id="chat-input"
          type="text"
          placeholder="Ask about your project status, tasks, or requirements..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          className="input-field flex-1 text-sm bg-white border border-slate-200 text-slate-900 shadow-sm focus:border-slate-800 focus:ring-slate-800/10"
          disabled={loading}
        />
        <button
          id="send-btn"
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 flex-shrink-0 shadow-sm active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
