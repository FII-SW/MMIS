import { useState } from "react";
import API from "../../api";
import { getTokenSession } from "../../utils/auth";
import { formatDateTime } from "./formatDate";
import { pmTypeLabel } from "./pmTypes";
import { printPMRecord } from "./printPMRecord";
import { downloadPMRecordPdf, exportPMHistoryCsv } from "./downloadPM";

const RESULT_BADGE = {
  passed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  na: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const RESULT_LABEL = { passed: "PASSED", failed: "FAILED", na: "N/A" };
const FIELD_LABEL = { notes: "Notes", parts_replaced: "Parts replaced" };

function AuditLog({ entries }) {
  if (!entries.length) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">No changes since it was recorded.</p>;
  }
  return (
    <ul className="space-y-1.5 text-xs">
      {entries.map((entry) => (
        <li key={entry.audit_id} className="text-gray-700 dark:text-gray-300">
          <b>{entry.action === "void" ? "Voided" : "Edited"}</b> by {entry.by || "Unknown"} · {formatDateTime(entry.at)}
          {entry.action === "void" && <span>: {entry.details?.reason}</span>}
          {entry.action === "edit" &&
            Object.entries(entry.details?.changes || {}).map(([field, change]) => (
              <div key={field} className="ml-3 text-gray-500 dark:text-gray-400">
                {FIELD_LABEL[field] || field}: “{change.from || "(empty)"}” → “{change.to || "(empty)"}”
              </div>
            ))}
        </li>
      ))}
    </ul>
  );
}

function RecordDetails({ record, fixture, session, onChanged, onDownload, downloading }) {
  const isAdmin = session?.role === "admin";
  const canEdit = !record.voided && (isAdmin || session?.employee_id === record.performed_by_employee_id);
  const [mode, setMode] = useState(null); // "edit" | "void" | null
  const [notes, setNotes] = useState(record.notes || "");
  const [partsText, setPartsText] = useState(record.parts_replaced || "");
  const [voidReason, setVoidReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState(null);

  const run = async (request) => {
    setSaving(true);
    setError("");
    try {
      await request();
      setMode(null);
      setAudit(null);
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save the change.");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = () =>
    run(() => API.patch(`/maintenance/pm-records/${record.pm_id}`, { notes, parts_replaced: partsText }));
  const saveVoid = () =>
    run(() => API.post(`/maintenance/pm-records/${record.pm_id}/void`, { reason: voidReason }));

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Permanently delete this ${pmTypeLabel(record.pm_type)} from ${formatDateTime(record.performed_at)}?\n\n` +
        "This cannot be undone and leaves no audit trail. Use Void instead if the record should stay visible for audits." +
        (record.parts?.length ? "\n\nParts taken from stock stay in the fixture's spare-parts history." : "")
    );
    if (!confirmed) return;
    run(() => API.delete(`/maintenance/pm-records/${record.pm_id}`));
  };

  const toggleAudit = async () => {
    if (audit) {
      setAudit(null);
      return;
    }
    try {
      const res = await API.get(`/maintenance/pm-records/${record.pm_id}/audit`);
      setAudit(res.data || []);
    } catch {
      setError("Could not load the change log.");
    }
  };

  return (
    <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-700">
      {record.voided && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <b>Voided</b> {formatDateTime(record.voided_at)} · {record.void_reason}. This PM no longer counts toward status.
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
            <th className="pb-1 font-semibold">Task</th>
            <th className="pb-1 font-semibold w-24">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {record.checklist.map((item) => (
            <tr key={item.item_id}>
              <td className="py-1.5 pr-2 text-gray-800 dark:text-gray-200">{item.task}</td>
              <td className="py-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${RESULT_BADGE[item.result]}`}>
                  {RESULT_LABEL[item.result]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {mode === "edit" ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm font-normal dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Parts replaced
            <textarea
              value={partsText}
              onChange={(e) => setPartsText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm font-normal dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 md:col-span-2">
            Task results can&apos;t be changed. If they were wrong, void this PM and record it again.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Notes</p>
            <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{record.notes || "(none)"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Parts replaced</p>
            <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{record.parts_replaced || "(none)"}</p>
            {record.parts?.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                {record.parts.map((part) => (
                  <li key={part.transaction_id}>
                    📦 {part.quantity} × {part.item_name}
                    {part.item_part_number ? ` (${part.item_part_number})` : ""} · taken from stock
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {mode === "void" && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xs font-semibold text-red-800 dark:text-red-200">
            Void this PM? It stays in history for audit but stops counting, and its open issues are closed.
            {record.parts?.length > 0 && " Parts taken from stock are not returned automatically; use the Return page if needed."}
          </p>
          <input
            type="text"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Reason (required), e.g. Recorded on the wrong fixture"
            className="mt-2 w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            autoFocus
          />
        </div>
      )}

      {audit && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/40">
          <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Change log</p>
          <AuditLog entries={audit} />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {mode ? (
          <>
            <button
              type="button"
              onClick={() => {
                setMode(null);
                setError("");
              }}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              Cancel
            </button>
            {mode === "edit" ? (
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            ) : (
              <button
                type="button"
                onClick={saveVoid}
                disabled={saving || !voidReason.trim()}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Voiding…" : "Void PM"}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleAudit}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {audit ? "Hide change log" : "Change log"}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            )}
            {isAdmin && !record.voided && (
              <button
                type="button"
                onClick={() => setMode("void")}
                className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Void
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Edit notes
              </button>
            )}
            {fixture && (
              <button
                type="button"
                onClick={() => printPMRecord(record, fixture)}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Print
              </button>
            )}
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {downloading ? "Downloading…" : "Download PDF"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PMHistory({ records, fixture, onChanged }) {
  const [filter, setFilter] = useState("all");
  const [showVoided, setShowVoided] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const session = getTokenSession();

  const handleDownload = async (record) => {
    setDownloadingId(record.pm_id);
    try {
      await downloadPMRecordPdf(record, fixture);
    } finally {
      setDownloadingId(null);
    }
  };

  const voidedCount = records.filter((r) => r.voided).length;
  const counted = showVoided ? records : records.filter((r) => !r.voided);
  const recordedTypes = [...new Set(counted.map((r) => r.pm_type))];
  const filters = [
    { value: "all", label: "All" },
    ...recordedTypes.map((type) => ({ value: type, label: pmTypeLabel(type) })),
  ];
  const visible = filter === "all" ? counted : counted.filter((r) => r.pm_type === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                filter === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {f.label}
            </button>
          ))}
          {voidedCount > 0 && (
            <label className="ml-2 flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
              Show voided ({voidedCount})
            </label>
          )}
        </div>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={() => exportPMHistoryCsv(visible, fixture)}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Export CSV ({visible.length})
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No PM records yet for this fixture.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((record) => {
            const expanded = expandedId === record.pm_id;
            return (
              <li
                key={record.pm_id}
                className={`rounded-lg border border-gray-200 dark:border-gray-700 ${record.voided ? "opacity-60" : ""}`}
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : record.pm_id)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-semibold text-gray-800 dark:text-gray-100 ${record.voided ? "line-through" : ""}`}
                        >
                          {pmTypeLabel(record.pm_type)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RESULT_BADGE[record.overall_result]}`}>
                          {RESULT_LABEL[record.overall_result]}
                        </span>
                        {record.voided && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">VOIDED</span>
                        )}
                        {record.edited_at && !record.voided && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            Edited
                          </span>
                        )}
                        {record.parts?.length > 0 && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            📦 {record.parts.length} part{record.parts.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {formatDateTime(record.performed_at)} · Name: {record.performed_by || "Unknown"}
                      </p>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400">{expanded ? "Hide" : "View"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(record)}
                    disabled={downloadingId === record.pm_id}
                    title="Download PDF"
                    className="shrink-0 border-l border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700/50"
                  >
                    {downloadingId === record.pm_id ? "…" : "⬇ PDF"}
                  </button>
                </div>

                {expanded && (
                  <RecordDetails
                    key={`${record.pm_id}-${record.edited_at || ""}-${record.voided}`}
                    record={record}
                    fixture={fixture}
                    session={session}
                    onChanged={onChanged}
                    onDownload={() => handleDownload(record)}
                    downloading={downloadingId === record.pm_id}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
