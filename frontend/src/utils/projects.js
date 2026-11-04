// Utility to get projects list from localStorage or defaults
import { IC_PROGRAMMING_LEGACY_NAME, IC_PROGRAMMING_PROJECT } from "./icProgramming";

// Default projects list
export const DEFAULT_PROJECTS = [
  "Astoria",
  "Athena",
  "Turin",
  "Bondi Beach",
  "Development",
  "Zebra Beach",
  "Mandolin Beach",
  "Gulp",
  "Xena",
  "Asahi",
  "Humu Beach",
  "Keysight",
  IC_PROGRAMMING_PROJECT,
  "Flying Probe",
];

function migrateProjectName(name) {
  if (name === "Agora") return "Asahi";
  if (name === IC_PROGRAMMING_LEGACY_NAME) return IC_PROGRAMMING_PROJECT;
  return name;
}

// Get projects from localStorage or use defaults
export const getProjects = () => {
  try {
    const stored = localStorage.getItem("mmis_projects");
    if (stored) {
      const parsed = JSON.parse(stored);
      const migrated = parsed.map(migrateProjectName).filter(Boolean);
      const allProjects = [...new Set([...DEFAULT_PROJECTS, ...migrated])];
      return allProjects.sort();
    }
  } catch (err) {
    console.error("Error loading projects from localStorage:", err);
  }
  return DEFAULT_PROJECTS;
};

// Check if a project is custom (not in default list)
export const isCustomProject = (project) => {
  return !DEFAULT_PROJECTS.includes(project);
};
