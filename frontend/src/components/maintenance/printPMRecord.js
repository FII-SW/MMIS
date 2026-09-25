import { formatDateTime } from "./formatDate";
import { pmTypeLabel } from "./pmTypes";

const RESULT_TEXT = { passed: "PASSED", failed: "FAILED", na: "N/A" };

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function printPMRecord(record, fixture) {
  const title = `${fixture.test_area || ""} ${fixture.fixture_name || ""} - ${pmTypeLabel(record.pm_type)}`.trim();
  const rows = record.checklist
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.task)}</td>
          <td class="${item.result === "failed" ? "fail" : ""}">${RESULT_TEXT[item.result] || escapeHtml(item.result)}</td>
        </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #111; margin: 32px; font-size: 13px; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 20px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #555; padding: 4px 6px; text-align: left; }
  th.head { background: #ccf5fb; text-align: center; }
  th.task { background: #d4f5c9; }
  th.result { background: #ccf5fb; width: 30%; }
  td.fail { color: #b91c1c; font-weight: bold; }
  .notes { border: 1px solid #555; border-top: none; padding: 6px; min-height: 90px; white-space: pre-wrap; }
  .footer { margin-top: 16px; line-height: 1.8; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <div><b>Project:</b> ${escapeHtml(fixture.project_name)}</div>
    <div><b>Period of Procedure:</b> ${escapeHtml(pmTypeLabel(record.pm_type))}</div>
    <div><b>Fixture:</b> ${escapeHtml(fixture.fixture_name)}</div>
    <div><b>Asset Tag:</b> ${escapeHtml(fixture.asset_tag || "—")}</div>
    <div><b>Test Area:</b> ${escapeHtml(fixture.test_area)}</div>
    <div><b>Overall Result:</b> ${escapeHtml((record.overall_result || "").toUpperCase())}</div>
    <div><b>Manufacturer:</b> ${escapeHtml(fixture.manufacturer || "—")}</div>
    <div><b>Line:</b> ${escapeHtml(fixture.production_line || "—")}</div>
  </div>
  <table>
    <tr><th class="head" colspan="2">${escapeHtml(title)}</th></tr>
    <tr><th class="task">Task</th><th class="result">Result</th></tr>
    ${rows}
  </table>
  <div class="notes"><b>Notes:</b> ${escapeHtml(record.notes || "(none)")}
<b>Parts replaced:</b> ${escapeHtml(record.parts_replaced || "(none)")}</div>
  <div class="footer">
    <div><b>Date:</b> ${escapeHtml(formatDateTime(record.performed_at))}</div>
    <div><b>Technician:</b> ${escapeHtml(record.performed_by || "Unknown")}</div>
    <div><b>Registered in IndySoft:</b> ${record.indysoft_recorded ? "Yes" : "No"}</div>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) {
    alert("Allow pop-ups for this site to print PM records.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
