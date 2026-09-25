import { useState } from "react";
import API from "../../api";
import { isAdminUser } from "../../utils/auth";
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

export default function PMHistory({ records, fixture, onDeleted }) {
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const isAdmin = isAdminUser();

  const handleDownload = async (record) => {
    setDownloadingId(record.pm_id);
    try {
      await downloadPMRecordPdf(record, fixture);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (record) => {
    const confirmed = window.confirm(
      `Delete this ${pmTypeLabel(record.pm_type)} record from ${formatDateTime(record.performed_at)}? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingId(record.pm_id);
    try {
      await API.delete(`/maintenance/pm-records/${record.pm_id}`);
      setExpandedId(null);
      onDeleted?.(record);
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to delete PM record.");
    } finally {
      setDeletingId(null);
    }
  };

  const recordedTypes = [...new Set(records.map((r) => r.pm_type))];
  const filters = [
    { value: "all", label: "All" },
    ...recordedTypes.map((type) => ({ value: type, label: pmTypeLabel(type) })),
  ];
  const visible = filter === "all" ? records : records.filter((r) => r.pm_type === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
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
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No PM records yet for this fixture.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((record) => {
            const expanded = expandedId === record.pm_id;
            return (
              <li key={record.pm_id} className="rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : record.pm_id)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {pmTypeLabel(record.pm_type)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RESULT_BADGE[record.overall_result]}`}>
                        {RESULT_LABEL[record.overall_result]}
                      </span>
                      {record.indysoft_recorded && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          IndySoft
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {formatDateTime(record.performed_at)} · Technician: {record.performed_by || "Unknown"}
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
                  <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-700">
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
                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Notes</p>
                        <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{record.notes || "(none)"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Parts replaced</p>
                        <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{record.parts_replaced || "(none)"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(record)}
                          disabled={deletingId === record.pm_id}
                          className="rounded-md border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          {deletingId === record.pm_id ? "Deleting…" : "Delete"}
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
                        onClick={() => handleDownload(record)}
                        disabled={downloadingId === record.pm_id}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600"
                      >
                        {downloadingId === record.pm_id ? "Downloading…" : "Download PDF"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
