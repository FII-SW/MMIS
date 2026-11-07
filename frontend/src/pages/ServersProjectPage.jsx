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
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white px-4 py-3 dark:border-blue-900/40 dark:from-blue-950/30 dark:to-gray-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-gray-100">
              FBT server inventory by project
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-gray-400">
              Track model, serial, IP, ZPE, network switch, Arista, and UPS for{" "}
              <span className="font-medium">FBT_Mobo</span> and <span className="font-medium">FBT_Agora</span>.
              {!loadingCounts && (
                <span className="ml-1 text-blue-700 dark:text-blue-300">
                  · {totalServers} server{totalServers === 1 ? "" : "s"} recorded
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(SERVERS_INVENTORY_URL)}
            className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Browse &amp; download CSV
          </button>
        </div>

        <input
          type="search"
          placeholder="Search projects…"
          aria-label="Search projects"
          autoFocus
          className="mb-4 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-900"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
              No projects match &quot;{search}&quot;
            </div>
          ) : (
            filtered.map((project) => {
              const n = counts[project] || 0;
              return (
                <button
                  type="button"
                  key={project}
                  onClick={() => navigate(serversTestAreaUrl(project))}
                  className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-xl border bg-white px-3 py-3 text-center shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow dark:bg-gray-800 dark:hover:border-blue-700 dark:hover:bg-gray-700 ${
                    n > 0
                      ? "border-blue-200 dark:border-blue-900/50"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <span className="line-clamp-2 text-sm font-semibold leading-snug text-gray-800 dark:text-gray-100">
                    {project}
                  </span>
                  <span
                    className={`text-[11px] ${
                      n > 0
                        ? "font-medium text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {loadingCounts
                      ? "…"
                      : n > 0
                        ? `${n} server${n === 1 ? "" : "s"}`
                        : "No servers yet"}
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
