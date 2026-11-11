import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { decodeToken, hasAdminAccess, isSuperAdminRole, isViewerRole } from "../utils/auth";
import { celebrate } from "../utils/celebrate";

const RECENT_KEY = "mmis_command_recent";

function getRole() {
  try {
    return decodeToken(localStorage.getItem("token"))?.role || null;
  } catch {
    return null;
  }
}

function loadRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(raw) ? raw.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function pushRecent(id) {
  const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function scoreMatch(query, text) {
  const q = query.trim().toLowerCase();
  const t = (text || "").toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 100 - t.length * 0.01;
  if (t.includes(q)) return 60 - t.indexOf(q) * 0.1;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.every((p) => t.includes(p))) return 40;
  return 0;
}

function buildCommands(role) {
  const viewer = isViewerRole(role);
  const admin = hasAdminAccess(role);
  const superAdmin = isSuperAdminRole(role);

  const items = [
    {
      id: "dash",
      group: "Go",
      label: "Dashboard",
      hint: "Home overview",
      path: "/dashboard",
      keywords: "home main",
    },
    !viewer && {
      id: "request",
      group: "Go",
      label: "Request parts",
      hint: "Pull stock for a fixture",
      path: "/dashboard/request",
      keywords: "checkout take",
    },
    !viewer && {
      id: "return",
      group: "Go",
      label: "Return parts",
      hint: "Put unused stock back",
      path: "/dashboard/return",
      keywords: "give back",
    },
    admin && {
      id: "restock",
      group: "Go",
      label: "Restock",
      hint: "Add stock or new items",
      path: "/dashboard/restock",
      keywords: "inventory add",
    },
    {
      id: "alerts",
      group: "Go",
      label: "Low stock alerts",
      hint: "Items below minimum",
      path: "/dashboard/alerts",
      keywords: "shortage",
    },
    {
      id: "reports",
      group: "Go",
      label: "Reports",
      hint: "Inventory & PM reports",
      path: "/dashboard/reports",
      keywords: "csv export",
    },
    {
      id: "activity",
      group: "Go",
      label: "Activity history",
      hint: "Requests, returns, restocks",
      path: "/dashboard/activity",
      keywords: "log transactions",
    },
    {
      id: "docs",
      group: "Go",
      label: "Documents",
      hint: "Project files",
      path: "/dashboard/documents",
      keywords: "pdf files",
    },
    {
      id: "servers",
      group: "Go",
      label: "Servers (FBT)",
      hint: "FBT server inventory",
      path: "/dashboard/servers",
      keywords: "ip mac line os",
    },
    {
      id: "fixtures",
      group: "Fixtures",
      label: "Fixture maintenance",
      hint: "Pick project → area → fixture",
      path: "/dashboard/maintenance",
      keywords: "pm preventive",
    },
    !viewer && {
      id: "my-pms",
      group: "Fixtures",
      label: "My PMs",
      hint: "Assigned to you",
      path: "/dashboard/maintenance/dashboard?tab=mine",
      keywords: "todo assigned",
    },
    {
      id: "pm-dash",
      group: "Fixtures",
      label: "PM dashboard",
      hint: "Status by project & type",
      path: "/dashboard/maintenance/dashboard",
      keywords: "overdue",
    },
    admin && {
      id: "transfer",
      group: "Go",
      label: "Transfer",
      hint: "Move stock between projects",
      path: "/dashboard/transfer",
      keywords: "move",
    },
    superAdmin && {
      id: "super",
      group: "Admin",
      label: "Super Admin",
      hint: "Users, settings, audit",
      path: "/dashboard/super-admin",
      keywords: "users workload",
    },
    {
      id: "how",
      group: "Help",
      label: "How it works",
      hint: "Step-by-step flows",
      path: "/dashboard/how-it-works",
      keywords: "guide tutorial",
    },
    {
      id: "profile",
      group: "Account",
      label: "Profile",
      hint: "Your account",
      path: "/dashboard/profile",
      keywords: "me settings",
    },
    {
      id: "theme",
      group: "Actions",
      label: "Toggle dark mode",
      hint: "Light ↔ dark",
      action: "theme",
      keywords: "night day appearance",
    },
    {
      id: "party",
      group: "Actions",
      label: "Celebrate",
      hint: "Because why not",
      action: "celebrate",
      keywords: "confetti fun party wow",
    },
  ];

  return items.filter(Boolean);
}

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("mmis:command-palette"));
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const role = getRole();

  const commands = useMemo(() => buildCommands(role), [role, open]);

  const filtered = useMemo(() => {
    const recent = loadRecent();
    const scored = commands
      .map((cmd) => {
        const blob = `${cmd.label} ${cmd.hint || ""} ${cmd.keywords || ""} ${cmd.group}`;
        let score = scoreMatch(query, blob);
        if (!query.trim()) {
          const ri = recent.indexOf(cmd.id);
          score = ri >= 0 ? 200 - ri : score || 1;
        }
        return { cmd, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.cmd.label.localeCompare(b.cmd.label));
    return scored.map((row) => row.cmd);
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const run = useCallback(
    (cmd) => {
      if (!cmd) return;
      pushRecent(cmd.id);
      close();
      if (cmd.action === "theme") {
        toggleTheme();
        return;
      }
      if (cmd.action === "celebrate") {
        celebrate({ intensity: 1.2 });
        return;
      }
      if (cmd.path) navigate(cmd.path);
    },
    [close, navigate, toggleTheme]
  );

  useEffect(() => {
    const onKey = (e) => {
      const isPalette = (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isPalette) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        run(filtered[active]);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mmis:command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mmis:command-palette", onOpen);
    };
  }, [open, filtered, active, close, run]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const groups = [];
  filtered.forEach((cmd) => {
    const last = groups[groups.length - 1];
    if (!last || last.name !== cmd.group) groups.push({ name: cmd.group, items: [cmd] });
    else last.items.push(cmd);
  });

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh] sm:pt-[15vh]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity"
        aria-label="Close command palette"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900/95"
        style={{ animation: "mmis-cmd-in 160ms ease-out" }}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
          <svg className="h-5 w-5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump anywhere… Request, PM, Servers, Reports"
            className="min-w-0 flex-1 border-0 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-gray-500"
          />
          <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[min(22rem,50vh)] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No matches</p>
          ) : (
            groups.map((group) => (
              <div key={group.name} className="mb-1">
                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">
                  {group.name}
                </p>
                <ul>
                  {group.items.map((cmd) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    const selected = idx === active;
                    return (
                      <li key={cmd.id}>
                        <button
                          type="button"
                          data-idx={idx}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => run(cmd)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                            selected
                              ? "bg-blue-600 text-white"
                              : "text-slate-800 hover:bg-slate-50 dark:text-gray-100 dark:hover:bg-gray-800"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{cmd.label}</span>
                            {cmd.hint && (
                              <span
                                className={`block truncate text-xs ${
                                  selected ? "text-blue-100" : "text-slate-400 dark:text-gray-500"
                                }`}
                              >
                                {cmd.hint}
                              </span>
                            )}
                          </span>
                          {cmd.path && (
                            <span
                              className={`hidden shrink-0 font-mono text-[10px] sm:inline ${
                                selected ? "text-blue-100" : "text-slate-300 dark:text-gray-600"
                              }`}
                            >
                              ↵
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400 dark:border-gray-800 dark:text-gray-500">
          <span>
            <kbd className="rounded border border-slate-200 px-1 dark:border-gray-600">↑↓</kbd> move{" "}
            <kbd className="ml-1 rounded border border-slate-200 px-1 dark:border-gray-600">↵</kbd> open
          </span>
          <span>Try “celebrate”</span>
        </div>
      </div>
    </div>
  );
}
