import { isIcProgrammingProject } from "./icProgramming";

/** Locations that do not use FBT/ICT-style test area selection. */
export const SKIP_TEST_AREA_PROJECTS = ["IC Programming", "Hi-Lo", "Flying Probe", "Development"];

export function projectRequiresTestArea(projectName) {
  if (!projectName || !String(projectName).trim()) return true;
  return !SKIP_TEST_AREA_PROJECTS.includes(String(projectName).trim());
}

/**
 * Development / Flying Probe skip fixture pick.
 * IC Programming requires a machine (stored as a fixture).
 */
export function projectRequiresFixture(projectName) {
  const name = String(projectName || "").trim();
  if (!name) return false;
  if (isIcProgrammingProject(name)) return true;
  return !["Flying Probe", "Development"].includes(name);
}

export function fixtureLabelForProject(projectName) {
  return isIcProgrammingProject(projectName) ? "Machine" : "Fixture";
}
