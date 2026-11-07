/**
 * Detect missing numbers in Project_TestArea_NN fixture naming
 * (e.g. Bondi Beach_FBT_Mobo_01 … _05 with _03 missing).
 */

export function extractFixtureSequenceNumber(fixtureName, projectName, testArea) {
  const name = String(fixtureName || "").trim();
  if (!name) return null;

  const project = String(projectName || "").trim();
  const area = String(testArea || "").trim();
  if (project && area) {
    const prefix = `${project}_${area}_`;
    if (name.startsWith(prefix)) {
      const match = name.slice(prefix.length).match(/^(\d+)/);
      if (match) return Number(match[1]);
    }
  }

  const trailing = name.match(/_(\d+)\s*$/);
  return trailing ? Number(trailing[1]) : null;
}

export function padSequenceNumber(n, width = 2) {
  return String(n).padStart(Math.max(width, String(n).length), "0");
}

/**
 * Returns missing integers between the lowest and highest numbered fixtures.
 * Only considers fixtures that end with _NN (or Project_Area_NN).
 */
export function findFixtureSequenceGaps(fixtures, projectName, testArea) {
  const numbers = [];
  let width = 2;

  (fixtures || []).forEach((fx) => {
    const n = extractFixtureSequenceNumber(
      fx.fixture_name,
      projectName || fx.project_name,
      testArea || fx.test_area
    );
    if (n == null || !Number.isFinite(n) || n < 1) return;
    numbers.push(n);
    const raw = String(fx.fixture_name || "").match(/_(\d+)\s*$/);
    if (raw) width = Math.max(width, raw[1].length);
  });

  if (numbers.length < 2) {
    return { gaps: [], width, min: null, max: null, counted: numbers.length };
  }

  const present = new Set(numbers);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const gaps = [];
  for (let i = min; i <= max; i += 1) {
    if (!present.has(i)) gaps.push(i);
  }

  return { gaps, width, min, max, counted: numbers.length };
}

/** Search token that finds Project_Area_NN or any name ending in _NN. */
export function sequenceSearchToken(n, width = 2) {
  return `_${padSequenceNumber(n, width)}`;
}
