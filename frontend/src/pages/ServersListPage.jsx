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

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      title={copied ? "Copied" : "Copy"}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1000);
        });
      }}
      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-300"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15V5a2 2 0 012-2h10" />
          </>
        )}
      </svg>
    </button>
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
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers
      .filter((s) => !q || serverSearchBlob(s).includes(q))
      .filter((s) => !incompleteOnly || serverMissingFields(s).length > 0)
      .sort((a, b) =>
        String(a.server_model || "").localeCompare(String(b.server_model || ""), undefined, {
          numeric: true,
        })
      );
  }, [servers, search, incompleteOnly]);

  const incompleteCount = useMemo(
    () => servers.filter((s) => serverMissingFields(s).length > 0).length,
    [servers]
  );

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
      mac_address: row.mac_address || "",
      os_type: row.os_type || "",
      os_version: row.os_version || "",
      line: row.line || "",
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
      setFormError("Model is required.");
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
        setToast("Updated");
      } else {
        await API.post("/servers/", body);
        setToast("Added");
      }
      setPanelOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Could not save."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.server_model}?`)) return;
    try {
      await API.delete(`/servers/${row.server_id}`);
      setToast("Deleted");
      load();
    } catch (err) {
      alert(apiErrorMessage(err, "Could not delete."));
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold text-slate-800 dark:text-gray-100">
            <span className="text-blue-600 dark:text-blue-400">{project}</span>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
            {serverAreaLabel(testArea)}
            {!loading && (
              <span className="ml-2 font-normal text-slate-400">
                {servers.length}
                {incompleteCount > 0 ? ` · ${incompleteCount} incomplete` : ""}
              </span>
            )}
          </h2>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-52"
          />

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800">
            {["table", "cards"].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${
                  view === id
                    ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-800 dark:text-gray-400"
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={incompleteOnly}
              onChange={(e) => setIncompleteOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            Incomplete
          </label>

          <button
            type="button"
            onClick={() => {
              if (!filtered.length) return;
              downloadServersCsv(filtered, { project, testArea });
            }}
            disabled={loading || filtered.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            CSV
          </button>

          <button
            type="button"
            onClick={() => navigate(serversInventoryUrl({ project, testArea }))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            All
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              + Add
            </button>
          )}
        </div>

        {toast && (
          <div className="mb-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            {toast}
          </div>
        )}

        {error && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-16 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center dark:border-gray-600">
            <p className="text-sm font-medium text-slate-600 dark:text-gray-300">
              {search || incompleteOnly ? "No matches" : "No servers"}
            </p>
            {canEdit && !search && !incompleteOnly && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                + Add server
              </button>
            )}
          </div>
        ) : view === "table" ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Model</th>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">Serial</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="hidden px-3 py-2 md:table-cell">MAC</th>
                    <th className="hidden px-3 py-2 lg:table-cell">OS</th>
                    <th className="hidden px-3 py-2 xl:table-cell">ZPE</th>
                    <th className="hidden px-3 py-2 xl:table-cell">UPS</th>
                    <th className="w-8 px-3 py-2" />
                    {canEdit && <th className="w-16 px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const missing = serverMissingFields(row).length;
                    return (
                      <tr
                        key={row.server_id}
                        onClick={() => openEdit(row)}
                        className={`border-b border-slate-50 last:border-0 dark:border-gray-700/60 ${
                          canEdit ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-700/30" : ""
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                          {row.server_model}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 dark:text-gray-400">
                          {row.line || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-gray-400">
                          {row.serial_number || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-blue-700 dark:text-blue-300">
                              {row.server_ip || "—"}
                            </span>
                            <CopyButton value={row.server_ip} />
                          </div>
                        </td>
                        <td className="hidden px-3 py-2 font-mono text-xs text-slate-500 dark:text-gray-400 md:table-cell">
                          {row.mac_address || "—"}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-500 dark:text-gray-400 lg:table-cell">
                          {[row.os_type, row.os_version].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-500 dark:text-gray-400 xl:table-cell">
                          {row.zpe_switch || "—"}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-500 dark:text-gray-400 xl:table-cell">
                          {row.ups || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {missing > 0 && (
                            <span
                              title={`${missing} incomplete`}
                              className="inline-block h-2 w-2 rounded-full bg-amber-400"
                            />
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => remove(row)}
                              className="text-xs font-medium text-red-500 hover:text-red-700"
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
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((row) => {
              const missing = serverMissingFields(row).length;
              return (
                <li
                  key={row.server_id}
                  onClick={() => openEdit(row)}
                  className={`rounded-xl border border-slate-200 bg-white p-3.5 dark:border-gray-700 dark:bg-gray-800 ${
                    canEdit ? "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700" : ""
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">
                        {row.server_model}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                          {row.server_ip || "—"}
                        </span>
                        <CopyButton value={row.server_ip} />
                        {missing > 0 && (
                          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(row);
                        }}
                        className="text-xs font-medium text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    {[
                      ["Line", row.line],
                      ["Serial", row.serial_number],
                      ["MAC", row.mac_address],
                      ["OS", [row.os_type, row.os_version].filter(Boolean).join(" ")],
                      ["ZPE", row.zpe_switch],
                      ["UPS", row.ups],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
                        <dd className="truncate text-slate-700 dark:text-gray-200">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40">
          <button type="button" className="flex-1 cursor-default" aria-label="Close" onClick={closePanel} />
          <aside className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editing ? "Edit server" : "Add server"}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {project} · {serverAreaLabel(testArea)}
                </p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {SERVER_FORM_SECTIONS.map((section) => (
                <section key={section.id}>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {section.title}
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <label
                        key={field.key}
                        className={
                          section.fields.length === 1 ||
                          field.key === "network_switch" ||
                          field.key === "server_model"
                            ? "sm:col-span-2"
                            : ""
                        }
                      >
                        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-gray-300">
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
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      </label>
                    ))}
                  </div>
                </section>
              ))}

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Notes
                </h3>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  placeholder="Notes"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </section>

              {formError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-4 py-3 dark:border-gray-800">
              <button
                type="button"
                onClick={closePanel}
                disabled={saving}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save" : "Add"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
