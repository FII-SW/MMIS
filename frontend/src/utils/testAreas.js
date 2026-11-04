/** Standard test areas used across request, restock, and reports. */
export const DEFAULT_TEST_AREAS = [
  "ICT_Mobo",
  "BSI_Mobo",
  "FBT_Mobo",
  "ICT_Agora",
  "FBT_Agora",
  "TOOLS",
  "ORT",
  "L10_Racks",
  "Golden_Board",
  "3070",
  "IC_Programming",
];

export const KEYSIGHT_PROJECT = "Keysight";
export const KEYSIGHT_TEST_AREA = "3070";

/** Shared-stock areas: their items are used on fixtures from every test area of the project. */
export const PROJECT_WIDE_AREAS = ["TOOLS", "Golden_Board"];
export const usesProjectFixtures = (testArea) => PROJECT_WIDE_AREAS.includes(testArea);

/** Merge predefined test areas with any values found in data. */
export const getTestAreas = (fromData = []) => {
  const fromItems = fromData.filter(Boolean);
  return [...new Set([...DEFAULT_TEST_AREAS, ...fromItems])].sort();
};

/** Test areas offered for a project (Keysight is 3070 only). */
export const testAreasForProject = (projectName, fromData = []) => {
  if (String(projectName || "").trim() === KEYSIGHT_PROJECT) {
    return [KEYSIGHT_TEST_AREA];
  }
  return getTestAreas(fromData);
};

/** When a project has exactly one test area, skip the picker. */
export const soleTestAreaForProject = (projectName) => {
  const areas = testAreasForProject(projectName);
  return areas.length === 1 ? areas[0] : null;
};

/** Stock-only areas: shown in Maintenance only when fixtures are registered there. */
const STOCK_ONLY_AREAS = ["Golden_Board"];

/** Test areas shown in Maintenance flow (TOOLS excluded), in the same order as Request. */
export const getMaintenanceTestAreas = (fromData = [], projectName = null) => {
  if (String(projectName || "").trim() === KEYSIGHT_PROJECT) {
    return [KEYSIGHT_TEST_AREA];
  }
  const present = new Set(fromData.filter(Boolean));
  const defaults = DEFAULT_TEST_AREAS.filter((area) => !STOCK_ONLY_AREAS.includes(area) || present.has(area));
  const extras = [...present].filter((area) => !DEFAULT_TEST_AREAS.includes(area)).sort();
  return [...defaults, ...extras].filter((area) => area !== "TOOLS");
};
