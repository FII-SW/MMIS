import API from "../../api";
import { formatDateTime } from "./formatDate";
import { pmTypeLabel } from "./pmTypes";

const RESULT_TEXT = { passed: "PASSED", failed: "FAILED", na: "N/A" };

function safeName(value) {
  return String(value || "").replace(/[^A-Za-z0-9._-]+/g, "_");
}

function localDateStamp(value) {
  const date = value ? new Date(value) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function blobErrorDetail(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text())?.detail;
    } catch {
      return null;
    }
  }
  return data?.detail;
}

export async function downloadPMRecordPdf(record, fixture) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const res = await API.get(`/maintenance/pm-records/${record.pm_id}/pdf`, {
      params: { tz },
      responseType: "blob",
    });
    const name = safeName(fixture?.fixture_name || `fixture_${record.fixture_id}`);
    saveBlob(res.data, `PM_${name}_${record.pm_type}_${localDateStamp(record.performed_at)}.pdf`);
  } catch (err) {
    alert((await blobErrorDetail(err)) || "Failed to download PM record.");
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportPMHistoryCsv(records, fixture) {
  const header = [
    "PM ID",
    "Fixture",
    "Project",
    "Test Area",
    "Event Type",
    "Date",
    "Result",
    "Entered By",
    "Registered in IndySoft",
    "Failed Tasks",
    "Notes",
    "Parts Replaced",
  ];
  const rows = records.map((record) => [
    record.pm_id,
    fixture?.fixture_name || record.fixture_id,
    record.project_name,
    record.test_area,
    pmTypeLabel(record.pm_type),
    formatDateTime(record.performed_at),
    RESULT_TEXT[record.overall_result] || record.overall_result,
    record.performed_by || "Unknown",
    record.indysoft_recorded ? "Yes" : "No",
    record.checklist.filter((item) => item.result === "failed").map((item) => item.task).join("; "),
    record.notes || "",
    record.parts_replaced || "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const name = safeName(fixture?.fixture_name || "fixture");
  saveBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `PM_History_${name}_${localDateStamp()}.csv`);
}
