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
];

/** Shared-stock areas: their items are used on fixtures from every test area of the project. */
export const PROJECT_WIDE_AREAS = ["TOOLS", "Golden_Board"];
export const usesProjectFixtures = (testArea) => PROJECT_WIDE_AREAS.includes(testArea);

/** Merge predefined test areas with any values found in data. */
export const getTestAreas = (fromData = []) => {
  const fromItems = fromData.filter(Boolean);
  return [...new Set([...DEFAULT_TEST_AREAS, ...fromItems])].sort();
};

/** Stock-only areas: shown in Maintenance only when fixtures are registered there. */
const STOCK_ONLY_AREAS = ["Golden_Board"];

/** Test areas shown in Maintenance flow (TOOLS excluded), in the same order as Request. */
export const getMaintenanceTestAreas = (fromData = []) => {
  const present = new Set(fromData.filter(Boolean));
  const defaults = DEFAULT_TEST_AREAS.filter((area) => !STOCK_ONLY_AREAS.includes(area) || present.has(area));
  const extras = [...present].filter((area) => !DEFAULT_TEST_AREAS.includes(area)).sort();
  return [...defaults, ...extras].filter((area) => area !== "TOOLS");
};
