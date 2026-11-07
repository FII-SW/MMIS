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
        setError(apiErrorMessage(err, "Could not load server inventory."));
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

  const scopeLabel = [
    projectFilter || "All projects",
    areaFilter ? serverAreaLabel(areaFilter) : "All FBT areas",
  ].join(" · ");

  const handleDownload = () => {
    if (!filtered.length) {
      alert("No servers to download for the current filters.");
      return;
    }
    downloadServersCsv(filtered, {
      project: projectFilter || undefined,
      testArea: areaFilter || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title={SERVERS_TITLE} onBack={() => navigate(SERVERS_BASE)} />

      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-gray-100">
              Server inventory
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Filter by project and test area, then download CSV for Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || filtered.length === 0}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download CSV ({filtered.length})
          </button>
        </div>

        <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-600 dark:text-gray-300">
            Project
            <select
              value={projectFilter}
              onChange={(e) => setFilter("project", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-gray-300">
            Test area
            <select
              value={areaFilter}
              onChange={(e) => setFilter("test_area", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">All (FBT_Mobo &amp; FBT_Agora)</option>
              {SERVER_TEST_AREAS.map((area) => (
                <option key={area} value={area}>
                  {serverAreaLabel(area)} ({area})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600 dark:text-gray-300">
            Search
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Model, serial, IP, switch…"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </div>

        <p className="mb-2 text-xs text-slate-500 dark:text-gray-400">
          Showing <span className="font-semibold text-slate-700 dark:text-gray-200">{filtered.length}</span>
          {filtered.length !== servers.length ? ` of ${servers.length}` : ""} · {scopeLabel}
          {(projectFilter || areaFilter || search) && (
            <button
              type="button"
              onClick={() => {
                setParams({}, { replace: true });
                setSearch("");
              }}
              className="ml-2 font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear filters
            </button>
          )}
        </p>

        {error && (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading servers…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-gray-600">
            <p className="font-semibold text-slate-700 dark:text-gray-200">No servers match</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
              Change filters or add servers from a project → FBT area.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Project</th>
                    <th className="px-3 py-2.5 font-semibold">Area</th>
                    <th className="px-3 py-2.5 font-semibold">Model</th>
                    <th className="px-3 py-2.5 font-semibold">Serial</th>
                    <th className="px-3 py-2.5 font-semibold">IP</th>
                    <th className="hidden px-3 py-2.5 font-semibold md:table-cell">ZPE</th>
                    <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">Network</th>
                    <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">Arista</th>
                    <th className="hidden px-3 py-2.5 font-semibold xl:table-cell">UPS</th>
                    <th className="px-3 py-2.5 font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.server_id}
                      className="border-b border-slate-100 last:border-0 dark:border-gray-700/70"
                    >
                      <td className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-gray-200">
                        {row.project_name}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 dark:text-gray-300">
                        {serverAreaLabel(row.test_area)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                        {row.server_model}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-gray-300">
                        {row.serial_number || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-700 dark:text-blue-300">
                        {row.server_ip || "—"}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-slate-600 dark:text-gray-300 md:table-cell">
                        {row.zpe_switch || "—"}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-slate-600 dark:text-gray-300 lg:table-cell">
                        {row.network_switch || "—"}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-slate-600 dark:text-gray-300 lg:table-cell">
                        {row.arista_switch || "—"}
                      </td>
                      <td className="hidden px-3 py-2 text-xs text-slate-600 dark:text-gray-300 xl:table-cell">
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
