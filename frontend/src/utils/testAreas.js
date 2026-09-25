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
];

/** Merge predefined test areas with any values found in data. */
export const getTestAreas = (fromData = []) => {
  const fromItems = fromData.filter(Boolean);
  return [...new Set([...DEFAULT_TEST_AREAS, ...fromItems])].sort();
};

/** Test areas shown in Maintenance flow (TOOLS excluded), in the same order as Request. */
export const getMaintenanceTestAreas = (fromData = []) => {
  const extras = fromData.filter((area) => area && !DEFAULT_TEST_AREAS.includes(area)).sort();
  return [...new Set([...DEFAULT_TEST_AREAS, ...extras])].filter((area) => area !== "TOOLS");
};
