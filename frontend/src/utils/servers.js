/** FBT server inventory — only these test areas. */
export const SERVER_TEST_AREAS = ["FBT_Mobo", "FBT_Agora"];

export const SERVER_AREA_LABELS = {
  FBT_Mobo: "FBT Mobo",
  FBT_Agora: "FBT Agora",
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
  "MAC Address",
  "OS Type",
  "OS Version",
  "Line",
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
    s.mac_address,
    s.os_type,
    s.os_version,
    s.line,
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
  mac_address: "",
  os_type: "",
  os_version: "",
  line: "",
  server_ip: "",
  zpe_switch: "",
  network_switch: "",
  arista_switch: "",
  ups: "",
  notes: "",
};

/** Form sections for add/edit panel. */
export const SERVER_FORM_SECTIONS = [
  {
    id: "identity",
    title: "Server",
    fields: [
      { key: "server_model", label: "Model", required: true, placeholder: "Model" },
      { key: "serial_number", label: "Serial", placeholder: "Serial" },
      { key: "line", label: "Line", placeholder: "Line" },
    ],
  },
  {
    id: "network",
    title: "Network",
    fields: [
      { key: "server_ip", label: "IP", placeholder: "IP" },
      { key: "mac_address", label: "MAC", placeholder: "MAC" },
      { key: "zpe_switch", label: "ZPE", placeholder: "ZPE" },
      { key: "network_switch", label: "Network switch", placeholder: "Network switch" },
      { key: "arista_switch", label: "Arista", placeholder: "Arista" },
    ],
  },
  {
    id: "os",
    title: "OS",
    fields: [
      { key: "os_type", label: "OS type", placeholder: "OS type" },
      { key: "os_version", label: "OS version", placeholder: "OS version" },
    ],
  },
  {
    id: "power",
    title: "Power",
    fields: [{ key: "ups", label: "UPS", placeholder: "UPS" }],
  },
];

export function serverSearchBlob(server) {
  return [
    server.server_model,
    server.serial_number,
    server.mac_address,
    server.os_type,
    server.os_version,
    server.line,
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
  if (!server.mac_address) missing.push("MAC");
  if (!server.os_type) missing.push("OS type");
  if (!server.os_version) missing.push("OS version");
  if (!server.line) missing.push("Line");
  if (!server.server_ip) missing.push("IP");
  if (!server.zpe_switch) missing.push("ZPE");
  if (!server.network_switch) missing.push("Network");
  if (!server.arista_switch) missing.push("Arista");
  if (!server.ups) missing.push("UPS");
  return missing;
}
