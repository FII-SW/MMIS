export function fixtureDetailUrl(fixture, extra = {}) {
  const query = new URLSearchParams();
  if (fixture.project_name) query.set("project", fixture.project_name);
  if (fixture.test_area) query.set("test_area", fixture.test_area);
  Object.entries(extra).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return `/dashboard/maintenance/fixture/${fixture.fixture_id}?${query.toString()}`;
}
