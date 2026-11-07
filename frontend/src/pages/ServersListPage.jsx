import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { apiErrorMessage } from "../utils/apiError";
import { getTokenSession, hasAdminAccess } from "../utils/auth";
import {
  EMPTY_SERVER_FORM,
  SERVER_FORM_SECTIONS,
  SERVER_TEST_AREAS,
  SERVERS_BASE,
  SERVERS_TITLE,
  downloadServersCsv,
  serverAreaLabel,
  serverMissingFields,
  serverSearchBlob,
  serversInventoryUrl,
  serversTestAreaUrl,
} from "../utils/servers";

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-gray-700"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function StatChip({ label, value, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-gray-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  };
  return (
    <div className={`rounded-xl px-3 py-2 ${tones[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
    </div>
  );
}

export default function ServersListPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const project = params.get("project") || "";
  const testArea = params.get("test_area") || "";

  const canEdit = hasAdminAccess(getTokenSession()?.role);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(() => localStorage.getItem("mmis_servers_view") || "table");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [toast, setToast] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_SERVER_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const areaOk = SERVER_TEST_AREAS.includes(testArea);

  const load = useCallback(() => {
    if (!project || !areaOk) return;
    setLoading(true);
    setError("");
    API.get("/servers/", { params: { project, test_area: testArea } })
      .then((res) => setServers(res.data || []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load servers.")))
      .finally(() => setLoading(false));
  }, [project, testArea, areaOk]);

  useEffect(() => {
    if (!project || !areaOk) {
      navigate(project ? serversTestAreaUrl(project) : SERVERS_BASE, { replace: true });
      return;
    }
    load();
  }, [project, areaOk, load, navigate]);

  useEffect(() => {
    localStorage.setItem("mmis_servers_view", view);
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers
      .filter((s) => (!q || serverSearchBlob(s).includes(q)))
      .filter((s) => (!incompleteOnly || serverMissingFields(s).length > 0))
      .sort((a, b) =>
        String(a.server_model || "").localeCompare(String(b.server_model || ""), undefined, {
          numeric: true,
        })
      );
  }, [servers, search, incompleteOnly]);

  const stats = useMemo(() => {
    const withIp = servers.filter((s) => s.server_ip).length;
    const incomplete = servers.filter((s) => serverMissingFields(s).length > 0).length;
    return { total: servers.length, withIp, incomplete };
  }, [servers]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_SERVER_FORM);
    setFormError("");
    setPanelOpen(true);
  };

  const openEdit = (row) => {
    if (!canEdit) return;
    setEditing(row);
    setForm({
      server_model: row.server_model || "",
      serial_number: row.serial_number || "",
      server_ip: row.server_ip || "",
      zpe_switch: row.zpe_switch || "",
      network_switch: row.network_switch || "",
      arista_switch: row.arista_switch || "",
      ups: row.ups || "",
      notes: row.notes || "",
    });
    setFormError("");
    setPanelOpen(true);
  };

  const closePanel = () => {
    if (saving) return;
    setPanelOpen(false);
    setEditing(null);
    setFormError("");
  };

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) {
        setPanelOpen(false);
        setEditing(null);
        setFormError("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, saving]);

  const save = async () => {
    if (!form.server_model.trim()) {
      setFormError("Server model is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    const body = {
      project_name: project,
      test_area: testArea,
      ...Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
      ),
    };
    try {
      if (editing) {
        await API.put(`/servers/${editing.server_id}`, body);
        setToast("Server updated");
      } else {
        await API.post("/servers/", body);
        setToast("Server added");
      }
      setPanelOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Could not save server."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.server_model}"?\n\nThis cannot be undone.`)) return;
    try {
      await API.delete(`/servers/${row.server_id}`);
      setToast("Server deleted");
      load();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not delete server."));
    }
  };

  if (!project || !areaOk) return null;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack
        title={SERVERS_TITLE}
        onBack={() => navigate(serversTestAreaUrl(project))}
      />

      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        {/* Context + actions */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              <span className="text-blue-600 dark:text-blue-400">{project}</span>
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              <span>{serverAreaLabel(testArea)}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {serverAreaLabel(testArea)} · {testArea}
              {canEdit ? " · Click a row to edit" : " · View only"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model, serial, IP, switch…"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-64"
            />
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800">
              {[
                { id: "table", label: "Table" },
                { id: "cards", label: "Cards" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setView(opt.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    view === opt.id
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <input
                type="checkbox"
                checked={incompleteOnly}
                onChange={(e) => setIncompleteOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              Incomplete only
            </label>
            <button
              type="button"
              onClick={() => {
                if (!filtered.length) {
                  alert("No servers to download.");
                  return;
                }
                downloadServersCsv(filtered, { project, testArea });
              }}
              disabled={loading || filtered.length === 0}
              className="rounded-xl border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:bg-gray-800 dark:text-emerald-300 dark:hover:bg-gray-700"
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(serversInventoryUrl({ project, testArea }))
              }
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              All inventory
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={openCreate}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                + Add server
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-3 gap-2 sm:max-w-md">
          <StatChip label="Total" value={loading ? "…" : stats.total} tone="blue" />
          <StatChip label="With IP" value={loading ? "…" : stats.withIp} />
          <StatChip
            label="Incomplete"
            value={loading ? "…" : stats.incomplete}
            tone={stats.incomplete ? "amber" : "slate"}
          />
        </div>

        {toast && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {toast}
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {!loading && filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-gray-600 dark:bg-gray-800/60">
            <p className="text-lg font-semibold text-slate-800 dark:text-gray-100">
              {search || incompleteOnly ? "No matches" : "No servers yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-gray-400">
              {search || incompleteOnly
                ? "Try clearing search or the Incomplete filter."
                : canEdit
                  ? "Add the first server for this project and FBT line — model, serial, IP, and switches."
                  : "Ask an admin to record servers here."}
            </p>
            {canEdit && !search && !incompleteOnly && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                + Add first server
              </button>
            )}
          </div>
        ) : view === "table" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Model</th>
                    <th className="px-3 py-2.5 font-semibold">Serial</th>
                    <th className="px-3 py-2.5 font-semibold">IP</th>
                    <th className="hidden px-3 py-2.5 font-semibold md:table-cell">ZPE</th>
                    <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">Network</th>
                    <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">Arista</th>
                    <th className="hidden px-3 py-2.5 font-semibold xl:table-cell">UPS</th>
                    <th className="px-3 py-2.5 font-semibold">Gaps</th>
                    {canEdit && <th className="px-3 py-2.5 font-semibold"> </th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const missing = serverMissingFields(row);
                    return (
                      <tr
                        key={row.server_id}
                        onClick={() => openEdit(row)}
                        className={`border-b border-slate-100 last:border-0 dark:border-gray-700/80 ${
                          canEdit ? "cursor-pointer hover:bg-blue-50/70 dark:hover:bg-gray-700/40" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                          {row.server_model}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-gray-300">
                          {row.serial_number || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-blue-700 dark:text-blue-300">
                              {row.server_ip || "—"}
                            </span>
                            <CopyButton value={row.server_ip} label="IP" />
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 text-xs text-slate-600 dark:text-gray-300 md:table-cell">
                          {row.zpe_switch || "—"}
                        </td>
                        <td className="hidden px-3 py-2.5 text-xs text-slate-600 dark:text-gray-300 lg:table-cell">
                          {row.network_switch || "—"}
                        </td>
                        <td className="hidden px-3 py-2.5 text-xs text-slate-600 dark:text-gray-300 lg:table-cell">
                          {row.arista_switch || "—"}
                        </td>
                        <td className="hidden px-3 py-2.5 text-xs text-slate-600 dark:text-gray-300 xl:table-cell">
                          {row.ups || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {missing.length === 0 ? (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              Complete
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                              {missing.slice(0, 2).join(", ")}
                              {missing.length > 2 ? ` +${missing.length - 2}` : ""}
                            </span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => remove(row)}
                              className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((row) => {
              const missing = serverMissingFields(row);
              return (
                <li
                  key={row.server_id}
                  onClick={() => openEdit(row)}
                  className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 ${
                    canEdit ? "cursor-pointer" : ""
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">
                        {row.server_model}
                      </h2>
                      <div className="mt-0.5 flex items-center gap-1">
                        <p className="font-mono text-xs text-blue-600 dark:text-blue-400">
                          {row.server_ip || "No IP"}
                        </p>
                        <CopyButton value={row.server_ip} label="Copy IP" />
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(row);
                        }}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-gray-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    {[
                      ["Serial", row.serial_number],
                      ["ZPE", row.zpe_switch],
                      ["Network", row.network_switch],
                      ["Arista", row.arista_switch],
                      ["UPS", row.ups],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {label}
                        </dt>
                        <dd className="truncate font-medium text-slate-800 dark:text-gray-100">
                          {value || "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {missing.length > 0 && (
                    <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-amber-700 dark:border-gray-700 dark:text-amber-300">
                      Missing: {missing.join(", ")}
                    </p>
                  )}
                  {row.notes && (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-gray-400">
                      {row.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/45 backdrop-blur-[1px]">
          <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={closePanel} />
          <aside className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-gray-700">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editing ? "Edit server" : "Add server"}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  {project} · {serverAreaLabel(testArea)} · Esc to close
                </p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {SERVER_FORM_SECTIONS.map((section) => (
                <section key={section.id}>
                  <div className="mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                      {section.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-gray-500">{section.hint}</p>
                  </div>
                  <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/50">
                    {section.fields.map((field) => (
                      <label key={field.key} className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-gray-300">
                          {field.label}
                          {field.required ? <span className="text-red-500"> *</span> : null}
                        </span>
                        <input
                          type="text"
                          value={form[field.key]}
                          autoFocus={field.key === "server_model" && !editing}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              save();
                            }
                          }}
                          placeholder={field.placeholder}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        />
                      </label>
                    ))}
                  </div>
                </section>
              ))}

              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-gray-400">
                  Notes
                </h3>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Rack U, cables, spare info…"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </section>

              {formError && (
                <p className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-200 px-4 py-3 dark:border-gray-700">
              <button
                type="button"
                onClick={closePanel}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Add server"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
