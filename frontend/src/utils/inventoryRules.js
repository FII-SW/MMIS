/** Projects that do not use test area selection in request/restock flows. */
export const SKIP_TEST_AREA_PROJECTS = ["Hi-Lo", "Flying Probe", "Development"];

export function projectRequiresTestArea(projectName) {
  if (!projectName || !String(projectName).trim()) return true;
  return !SKIP_TEST_AREA_PROJECTS.includes(String(projectName).trim());
}
