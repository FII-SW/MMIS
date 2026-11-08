import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { apiErrorMessage } from "../utils/apiError";
import { getProjects } from "../utils/projects";
import {
  SERVER_TEST_AREAS,
  SERVERS_BASE,
  SERVERS_TITLE,
  downloadServersCsv,
  serverAreaLabel,
  serverSearchBlob,
  serversListUrl,
} from "../utils/servers";

export default function ServersInventoryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const projectFilter = params.get("project") || "";
  const areaFilter = params.get("test_area") || "";

  const [projects] = useState(getProjects());
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const query = {};
    if (projectFilter) query.project = projectFilter;
    if (areaFilter) query.test_area = areaFilter;
    API.get("/servers/", { params: query })
      .then((res) => setServers(res.data || []))
      .catch((err) => {
        setServers([]);
        setError(apiErrorMessage(err, "Could not load inventory."));
      })
      .finally(() => setLoading(false));
  }, [projectFilter, areaFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((s) => serverSearchBlob(s).includes(q));
  }, [servers, search]);

  const handleDownload = () => {
    if (!filtered.length) return;
    downloadServersCsv(filtered, {
      project: projectFilter || undefined,
      testArea: areaFilter || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title={SERVERS_TITLE} onBack={() => navigate(SERVERS_BASE)} />

      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setFilter("project", e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={areaFilter}
            onChange={(e) => setFilter("test_area", e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All areas</option>
            {SERVER_TEST_AREAS.map((area) => (
              <option key={area} value={area}>
                {serverAreaLabel(area)}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-52"
          />

          <span className="ml-auto text-xs text-slate-400">
            {loading ? "…" : filtered.length}
            {(projectFilter || areaFilter || search) && (
              <button
                type="button"
                onClick={() => {
                  setParams({}, { replace: true });
                  setSearch("");
                }}
                className="ml-2 font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                Clear
              </button>
            )}
          </span>

          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || filtered.length === 0}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Download CSV
          </button>
        </div>

        {error && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400 dark:border-gray-600">
            No servers
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Area</th>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">Serial</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="hidden px-3 py-2 md:table-cell">MAC</th>
                    <th className="hidden px-3 py-2 lg:table-cell">OS</th>
                    <th className="hidden px-3 py-2 xl:table-cell">UPS</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.server_id}
                      className="border-b border-slate-50 last:border-0 dark:border-gray-700/60"
                    >
                      <td className="px-3 py-2 text-xs text-slate-600 dark:text-gray-300">
                        {row.project_name}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 dark:text-gray-400">
                        {serverAreaLabel(row.test_area)}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                        {row.server_model}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 dark:text-gray-400">
                        {row.line || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-gray-400">
                        {row.serial_number || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-700 dark:text-blue-300">
                        {row.server_ip || "—"}
                      </td>
                      <td className="hidden px-3 py-2 font-mono text-xs text-slate-500 dark:text-gray-400 md:table-cell">
                        {row.mac_address || "—"}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-slate-500 dark:text-gray-400 lg:table-cell">
                        {[row.os_type, row.os_version].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-slate-500 dark:text-gray-400 xl:table-cell">
                        {row.ups || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(serversListUrl(row.project_name, row.test_area))
                          }
                          className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
