import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { getProjects } from "../utils/projects";
import { SERVERS_INVENTORY_URL, SERVERS_TITLE, serversTestAreaUrl } from "../utils/servers";

export default function ServersProjectPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState(getProjects());
  const [counts, setCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    const update = () => setProjects(getProjects());
    window.addEventListener("projectsUpdated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("projectsUpdated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  useEffect(() => {
    setLoadingCounts(true);
    API.get("/servers/")
      .then((res) => {
        const next = {};
        (res.data || []).forEach((row) => {
          const key = row.project_name || "";
          next[key] = (next[key] || 0) + 1;
        });
        setCounts(next);
      })
      .catch(() => setCounts({}))
      .finally(() => setLoadingCounts(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? projects.filter((p) => p.toLowerCase().includes(q))
      : [...projects];
    return list.sort((a, b) => {
      const ca = counts[a] || 0;
      const cb = counts[b] || 0;
      if (cb !== ca) return cb - ca;
      return a.localeCompare(b);
    });
  }, [projects, search, counts]);

  const totalServers = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title={SERVERS_TITLE} onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search projects…"
            aria-label="Search projects"
            autoFocus
            className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!loadingCounts && (
            <span className="text-xs text-slate-400">{totalServers} servers</span>
          )}
          <button
            type="button"
            onClick={() => navigate(SERVERS_INVENTORY_URL)}
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
          >
            CSV inventory
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-gray-600">
              No projects
            </div>
          ) : (
            filtered.map((project) => {
              const n = counts[project] || 0;
              return (
                <button
                  type="button"
                  key={project}
                  onClick={() => navigate(serversTestAreaUrl(project))}
                  className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 rounded-xl border bg-white px-3 py-2.5 text-center transition hover:border-blue-300 hover:bg-blue-50/60 dark:bg-gray-800 dark:hover:border-blue-700 dark:hover:bg-gray-700 ${
                    n > 0
                      ? "border-blue-200 dark:border-blue-900/50"
                      : "border-slate-200 dark:border-gray-700"
                  }`}
                >
                  <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 dark:text-gray-100">
                    {project}
                  </span>
                  <span
                    className={`text-[11px] ${
                      n > 0
                        ? "font-medium text-blue-600 dark:text-blue-400"
                        : "text-slate-400 dark:text-gray-500"
                    }`}
                  >
                    {loadingCounts ? "…" : n || "—"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
