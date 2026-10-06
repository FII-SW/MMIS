import { Fragment, useEffect, useState } from "react";
import API from "../../api";
import { apiErrorMessage } from "../../utils/apiError";
import { downloadCsv } from "../maintenance/downloadPM";
import { formatDateTime } from "../maintenance/formatDate";
import { BUTTON_SECONDARY, BUTTON_SMALL, CARD, FIELD, Label, Notice } from "./ui";

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 1000;

const ACTION_LABELS = {
  create: "Created",
  update: "Edited",
  delete: "Deleted",
  restock: "Restocked",
  transfer: "Transferred",
  upload: "Uploaded",
  image: "Image changed",
  pin: "Pinned",
  unpin: "Unpinned",
  void: "Voided",
  edit: "Edited",
  pause: "PM paused",
  resume: "PM resumed",
  assign: "PM assigned",
  unassign: "PM unassigned",
  role_change: "Access changed",
  activate: "Activated",
  deactivate: "Deactivated",
  password_reset: "Password reset",
  settings: "Settings changed",
};

const ENTITY_LABELS = {
  item: "Inventory item",
  fixture: "Fixture",
  document: "Document",
  pm_record: "PM record",
  user: "User",
  setting: "Setting",
};

const label = (map, value) => map[value] || String(value || "").replace(/_/g, " ");

function toParams(filters, extra) {
  const params = { ...extra };
  if (filters.dateFrom) params.date_from = new Date(`${filters.dateFrom}T00:00:00`).toISOString();
  if (filters.dateTo) {
    const next = new Date(`${filters.dateTo}T00:00:00`);
    next.setDate(next.getDate() + 1);
    params.date_to = next.toISOString();
  }
  if (filters.employeeId) params.employee_id = filters.employeeId;
  if (filters.entityType) params.entity_type = filters.entityType;
  if (filters.action) params.action = filters.action;
  if (filters.q.trim()) params.q = filters.q.trim();
  return params;
}

function Changes({ details }) {
  const changes = details?.changes;
  if (!changes || !Object.keys(changes).length) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">No field-level details.</p>;
  }
  return (
    <ul className="space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
      {Object.entries(changes).map(([field, change]) => (
        <li key={field}>
          <b>{field.replace(/^employee_|^item_/, "").replace(/_/g, " ")}</b>: “{String(change?.from ?? "") || "(empty)"}” → “
          {String(change?.to ?? "") || "(empty)"}”
        </li>
      ))}
    </ul>
  );
}

export default function AuditTab() {
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", employeeId: "", entityType: "", action: "", q: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ total: 0, entries: [], entity_types: [], actions: [] });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    API.get("/admin/users")
      .then((res) => setUsers(res.data.users || []))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    API.get("/admin/audit", { params: toParams(applied, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }) })
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setError("");
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err, "Could not load the audit log.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applied, page]);

  const set = (field) => (e) => setFilters((prev) => ({ ...prev, [field]: e.target.value }));
  const apply = (e) => {
    e?.preventDefault();
    setPage(1);
    setApplied(filters);
  };
  const clear = () => {
    const empty = { dateFrom: "", dateTo: "", employeeId: "", entityType: "", action: "", q: "" };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await API.get("/admin/audit", { params: toParams(applied, { limit: EXPORT_LIMIT, offset: 0 }) });
      const rows = (res.data.entries || []).map((entry) => [
        formatDateTime(entry.created_at),
        entry.employee_name || "",
        label(ACTION_LABELS, entry.action),
        label(ENTITY_LABELS, entry.entity_type),
        entry.entity_id || "",
        entry.summary,
        entry.details?.changes
          ? Object.entries(entry.details.changes)
              .map(([field, change]) => `${field}: ${change?.from ?? ""} -> ${change?.to ?? ""}`)
              .join("; ")
          : "",
      ]);
      downloadCsv("MMIS_Audit_Log", ["Date", "By", "Action", "Type", "ID", "Summary", "Changes"], rows);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not export the audit log."));
    } finally {
      setExporting(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Notice onClose={() => setError("")}>{error}</Notice>

      <form onSubmit={apply} className={`${CARD} space-y-3`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label>
            <Label>From</Label>
            <input type="date" className={FIELD} value={filters.dateFrom} onChange={set("dateFrom")} />
          </label>
          <label>
            <Label>To</Label>
            <input type="date" className={FIELD} value={filters.dateTo} onChange={set("dateTo")} />
          </label>
          <label>
            <Label>By</Label>
            <select className={FIELD} value={filters.employeeId} onChange={set("employeeId")}>
              <option value="">Anyone</option>
              {users.map((user) => (
                <option key={user.employee_id} value={user.employee_id}>
                  {user.employee_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Label>Type</Label>
            <select className={FIELD} value={filters.entityType} onChange={set("entityType")}>
              <option value="">All types</option>
              {data.entity_types.map((type) => (
                <option key={type} value={type}>
                  {label(ENTITY_LABELS, type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Label>Action</Label>
            <select className={FIELD} value={filters.action} onChange={set("action")}>
              <option value="">All actions</option>
              {data.actions.map((action) => (
                <option key={action} value={action}>
                  {label(ACTION_LABELS, action)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Label>Search</Label>
            <input className={FIELD} value={filters.q} onChange={set("q")} placeholder="Words in the summary" />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={BUTTON_SECONDARY} onClick={clear}>
            Clear
          </button>
          <button type="button" className={BUTTON_SECONDARY} onClick={exportCsv} disabled={exporting || !data.total}>
            {exporting ? "Exporting…" : `Export CSV${data.total > EXPORT_LIMIT ? ` (latest ${EXPORT_LIMIT})` : ""}`}
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Apply filters
          </button>
        </div>
      </form>

      <div className={CARD}>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading audit log…</p>
        ) : data.entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No changes recorded for these filters. Changes are recorded from the day this update was installed.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="whitespace-nowrap py-2 pr-3 font-semibold">When</th>
                    <th className="py-2 pr-3 font-semibold">By</th>
                    <th className="py-2 pr-3 font-semibold">Action</th>
                    <th className="py-2 pr-3 font-semibold">Type</th>
                    <th className="py-2 pr-3 font-semibold">What changed</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.entries.map((entry) => (
                    <Fragment key={entry.audit_id}>
                      <tr>
                        <td className="whitespace-nowrap py-2 pr-3 text-gray-700 dark:text-gray-300">
                          {formatDateTime(entry.created_at)}
                        </td>
                        <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">{entry.employee_name || "—"}</td>
                        <td className="whitespace-nowrap py-2 pr-3 font-semibold text-gray-800 dark:text-gray-100">
                          {label(ACTION_LABELS, entry.action)}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-gray-700 dark:text-gray-300">
                          {label(ENTITY_LABELS, entry.entity_type)}
                          {entry.entity_id && <span className="text-xs text-gray-500"> #{entry.entity_id}</span>}
                        </td>
                        <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{entry.summary}</td>
                        <td className="py-2 text-right">
                          {entry.details && (
                            <button
                              type="button"
                              className={BUTTON_SMALL}
                              onClick={() => setExpanded(expanded === entry.audit_id ? null : entry.audit_id)}
                            >
                              {expanded === entry.audit_id ? "Hide" : "Details"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === entry.audit_id && (
                        <tr>
                          <td colSpan={6} className="bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                            <Changes details={entry.details} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>{data.total} change(s)</span>
              {pageCount > 1 && (
                <div className="flex items-center gap-3">
                  <button type="button" className={BUTTON_SECONDARY} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </button>
                  <span>
                    Page {page} of {pageCount}
                  </span>
                  <button
                    type="button"
                    className={BUTTON_SECONDARY}
                    disabled={page >= pageCount}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
