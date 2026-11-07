import {
  IC_PROGRAMMING_PROJECT,
  IC_PROGRAMMING_LEGACY_NAME,
  IC_PROGRAMMING_TEST_AREA,
} from "./icProgramming";

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

/**
 * Areas that belong to a specific project only — hidden on board-project pickers
 * (Request / Restock / Fixture Maintenance).
 */
export const PROJECT_SCOPED_TEST_AREAS = [KEYSIGHT_TEST_AREA, IC_PROGRAMMING_TEST_AREA];

/** Shared-stock areas: their items are used on fixtures from every test area of the project. */
export const PROJECT_WIDE_AREAS = ["TOOLS", "Golden_Board"];
export const usesProjectFixtures = (testArea) => PROJECT_WIDE_AREAS.includes(testArea);

function normalizeProject(projectName) {
  const name = String(projectName || "").trim();
  if (name === IC_PROGRAMMING_LEGACY_NAME) return IC_PROGRAMMING_PROJECT;
  return name;
}

/** Board-project defaults: hide Keysight 3070 and IC_Programming. */
export const BOARD_TEST_AREAS = DEFAULT_TEST_AREAS.filter(
  (area) => !PROJECT_SCOPED_TEST_AREAS.includes(area)
);

/** Merge predefined test areas with any values found in data. */
export const getTestAreas = (fromData = []) => {
  const fromItems = fromData.filter(Boolean);
  return [...new Set([...DEFAULT_TEST_AREAS, ...fromItems])].sort();
};

/** Test areas offered for a project in Request / Restock / Maintenance pickers. */
export const testAreasForProject = (projectName, fromData = []) => {
  const name = normalizeProject(projectName);
  if (name === KEYSIGHT_PROJECT) {
    return [KEYSIGHT_TEST_AREA];
  }
  if (name === IC_PROGRAMMING_PROJECT) {
    return [IC_PROGRAMMING_TEST_AREA];
  }
  const fromItems = (fromData || []).filter(
    (area) => area && !PROJECT_SCOPED_TEST_AREAS.includes(area)
  );
  return [...new Set([...BOARD_TEST_AREAS, ...fromItems])];
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
  const name = normalizeProject(projectName);
  if (name === KEYSIGHT_PROJECT) {
    return [KEYSIGHT_TEST_AREA];
  }
  if (name === IC_PROGRAMMING_PROJECT) {
    return [IC_PROGRAMMING_TEST_AREA];
  }

  const allowedDefaults = BOARD_TEST_AREAS.filter(
    (area) => !STOCK_ONLY_AREAS.includes(area) || (fromData || []).includes(area)
  );
  const present = new Set(
    (fromData || []).filter((area) => area && !PROJECT_SCOPED_TEST_AREAS.includes(area))
  );
  const extras = [...present].filter((area) => !BOARD_TEST_AREAS.includes(area)).sort();
  return [...allowedDefaults, ...extras].filter((area) => area !== "TOOLS");
};
