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
const PM_TYPES_BY_AREA_PREFIX = {
  FBT: ["weekly", "biweekly"],
  ICT: ["monthly"],
};

export function pmTypesForArea(testArea) {
  const area = String(testArea || "").trim().toUpperCase();
  const prefix = Object.keys(PM_TYPES_BY_AREA_PREFIX).find((p) => area.startsWith(p));
  return prefix ? PM_TYPES_BY_AREA_PREFIX[prefix] : [];
}
