export const PM_TYPE_LABELS = {
  weekly: "Weekly PM",
  biweekly: "Biweekly PM",
  monthly: "Monthly PM",
  quarterly: "Quarterly PM",
};

export function pmTypeLabel(pmType) {
  return PM_TYPE_LABELS[pmType] || pmType;
}

// Keep in sync with backend/app/utils/pm_checklists.py
const PM_TYPES_BY_FAMILY = {
  FBT: ["weekly", "biweekly"],
  ICT: ["monthly"], // GL6 ICT fixtures (ICT_Mobo / ICT_Agora)
  KEYSIGHT: ["monthly"], // Keysight i3070 system (area 3070)
  BSI: ["weekly", "biweekly", "monthly"],
};

/** Areas that use a checklist family without matching the family name prefix. */
const PM_AREA_ALIASES = {
  "3070": "KEYSIGHT",
};

/** GL6 ICT fixture PM is not used on these projects. */
const ICT_FIXTURE_EXCLUDED_PROJECTS = new Set([
  "IC Programming",
  "Hi-Lo",
  "Keysight",
  "Flying Probe",
]);

function normalizeProject(projectName) {
  const name = String(projectName || "").trim();
  return name === "Hi-Lo" ? "IC Programming" : name;
}

export function pmTypesForArea(testArea, projectName) {
  const area = String(testArea || "").trim().toUpperCase();
  const family =
    PM_AREA_ALIASES[area] ||
    Object.keys(PM_TYPES_BY_FAMILY).find((p) => area.startsWith(p));
  if (!family) return [];
  if (family === "ICT" && ICT_FIXTURE_EXCLUDED_PROJECTS.has(normalizeProject(projectName))) {
    return [];
  }
  return PM_TYPES_BY_FAMILY[family] || [];
}
