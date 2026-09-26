export const MAINTENANCE_PROJECTS_URL = "/dashboard/maintenance";
export const MAINTENANCE_DASHBOARD_URL = "/dashboard/maintenance/dashboard";

export function testAreaUrl(project) {
  return `/dashboard/maintenance/test-area?project=${encodeURIComponent(project)}`;
}

export function fixtureListUrl(project, testArea) {
  const query = new URLSearchParams();
  if (project) query.set("project", project);
  if (testArea) query.set("test_area", testArea);
  return `/dashboard/maintenance/work?${query.toString()}`;
}

export function fixtureDetailUrl(fixture, extra = {}) {
  const query = new URLSearchParams();
  if (fixture.project_name) query.set("project", fixture.project_name);
  if (fixture.test_area) query.set("test_area", fixture.test_area);
  Object.entries(extra).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return `/dashboard/maintenance/fixture/${fixture.fixture_id}?${query.toString()}`;
}
