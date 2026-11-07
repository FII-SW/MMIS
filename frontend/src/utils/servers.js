/** FBT server inventory — only these test areas. */
export const SERVER_TEST_AREAS = ["FBT_Mobo", "FBT_Agora"];

export const SERVER_AREA_LABELS = {
  FBT_Mobo: "FBT Mobo",
  FBT_Agora: "FBT Agora",
};

export const SERVER_AREA_HINTS = {
  FBT_Mobo: "Motherboard FBT line servers",
  FBT_Agora: "Agora FBT line servers",
};

export function serverAreaLabel(area) {
  return SERVER_AREA_LABELS[area] || area;
}

export const SERVERS_TITLE = "Servers";
export const SERVERS_BASE = "/dashboard/servers";
export const SERVERS_INVENTORY_URL = `${SERVERS_BASE}/inventory`;

export function serversTestAreaUrl(project) {
  return `${SERVERS_BASE}/test-area?project=${encodeURIComponent(project)}`;
}

export function serversListUrl(project, testArea) {
  const q = new URLSearchParams();
  if (project) q.set("project", project);
  if (testArea) q.set("test_area", testArea);
  return `${SERVERS_BASE}/list?${q.toString()}`;
}

export function serversInventoryUrl({ project, testArea } = {}) {
  const q = new URLSearchParams();
  if (project) q.set("project", project);
  if (testArea) q.set("test_area", testArea);
  const qs = q.toString();
  return qs ? `${SERVERS_INVENTORY_URL}?${qs}` : SERVERS_INVENTORY_URL;
}

export const SERVER_CSV_HEADERS = [
  "Project",
  "Test Area",
  "Server Model",
  "Serial Number",
  "Server IP",
  "ZPE Switch",
  "Network Switch",
  "Arista Switch",
  "UPS",
  "Notes",
];

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function localDateStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Download server rows as UTF-8 CSV (Excel-friendly BOM). */
export function downloadServersCsv(servers, { project, testArea } = {}) {
  const rows = (servers || []).map((s) => [
    s.project_name,
    s.test_area,
    s.server_model,
    s.serial_number,
    s.server_ip,
    s.zpe_switch,
    s.network_switch,
    s.arista_switch,
    s.ups,
    s.notes,
  ]);
  const csv = [SERVER_CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const parts = ["server_inventory"];
  if (project) parts.push(String(project).replace(/\s+/g, "_"));
  if (testArea) parts.push(String(testArea));
  parts.push(localDateStamp());
  const filename = `${parts.join("_")}.csv`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const EMPTY_SERVER_FORM = {
  server_model: "",
  serial_number: "",
  server_ip: "",
  zpe_switch: "",
  network_switch: "",
  arista_switch: "",
  ups: "",
  notes: "",
};

/** Form sections for a clearer add/edit panel. */
export const SERVER_FORM_SECTIONS = [
  {
    id: "identity",
    title: "Server",
    hint: "What is on the rack",
    fields: [
      { key: "server_model", label: "Model", required: true, placeholder: "e.g. Dell PowerEdge R760" },
      { key: "serial_number", label: "Serial number", placeholder: "Service tag / SN" },
    ],
  },
  {
    id: "network",
    title: "Network",
    hint: "IP and switches",
    fields: [
      { key: "server_ip", label: "Server IP", placeholder: "e.g. 10.1.2.30" },
      { key: "zpe_switch", label: "ZPE switch", placeholder: "ZPE name or port" },
      { key: "network_switch", label: "Network switch", placeholder: "Network switch" },
      { key: "arista_switch", label: "Arista switch", placeholder: "Arista switch" },
    ],
  },
  {
    id: "power",
    title: "Power",
    hint: "UPS / circuit",
    fields: [{ key: "ups", label: "UPS", placeholder: "UPS name or circuit" }],
  },
];

export function serverSearchBlob(server) {
  return [
    server.server_model,
    server.serial_number,
    server.server_ip,
    server.zpe_switch,
    server.network_switch,
    server.arista_switch,
    server.ups,
    server.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function serverMissingFields(server) {
  const missing = [];
  if (!server.serial_number) missing.push("Serial");
  if (!server.server_ip) missing.push("IP");
  if (!server.zpe_switch) missing.push("ZPE");
  if (!server.network_switch) missing.push("Network");
  if (!server.arista_switch) missing.push("Arista");
  if (!server.ups) missing.push("UPS");
  return missing;
}
