/**
 * IC Programming is a shared work cell (not a customer project).
 * It was previously listed as "Hi-Lo". Parts are requested against a machine.
 */
export const IC_PROGRAMMING_PROJECT = "IC Programming";
export const IC_PROGRAMMING_LEGACY_NAME = "Hi-Lo";

/** Known programmer machines. Add more here (or via Restock → New Fixtures). */
export const IC_PROGRAMMING_MACHINES = [
  "AT3-310A2",
  "AT3-310A2N",
  // Room for more, e.g.:
  // "AT3-310B1",
  // "AT3-310B1N",
];

export const IC_PROGRAMMING_TEST_AREA = "IC_Programming";

export function isIcProgrammingProject(projectName) {
  const name = String(projectName || "").trim();
  return name === IC_PROGRAMMING_PROJECT || name === IC_PROGRAMMING_LEGACY_NAME;
}

/** Normalize legacy "Hi-Lo" labels to IC Programming. */
export function normalizeProjectName(projectName) {
  const name = String(projectName || "").trim();
  return name === IC_PROGRAMMING_LEGACY_NAME ? IC_PROGRAMMING_PROJECT : name;
}
