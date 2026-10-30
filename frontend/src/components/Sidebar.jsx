import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  Plus,
  Bot,
  LogOut,
  Sparkles,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
  { to: "/projects/new", icon: Plus, label: "New Project" },
  { to: "/chat", icon: Bot, label: "AI Chat" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 h-full w-64 z-50 flex flex-col
                 bg-slate-900 text-slate-100 border-r border-slate-800"
    >
      {/* Logo Header */}
      <div className="px-6 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600
                          flex items-center justify-center shadow-sm flex-shrink-0">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">Project Intelligence</h1>
            <p className="text-xs font-medium text-slate-400">AI Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="px-5 pt-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Navigation
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium
               transition-colors duration-150 group relative
               ${isActive
                 ? "bg-slate-800 text-white"
                 : "text-slate-400 hover:text-white hover:bg-slate-800/60"
               }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-indigo-500" />}
                <Icon
                  size={18}
                  className={isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/60 border border-slate-800 mb-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600
                          flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.name || "User"}</p>
            <p className="text-xs text-slate-400 truncate font-medium">{user.email || ""}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400
                     hover:text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </motion.aside>
  );
}
