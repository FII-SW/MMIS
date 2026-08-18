import { useState, useEffect, useRef } from "react";
import { getProjects as getProjectsUtil, DEFAULT_PROJECTS, isCustomProject as isCustomProjectUtil } from "../utils/projects";

// Get projects from localStorage or use defaults
const getProjects = () => {
  return getProjectsUtil();
};

// Save projects to localStorage
const saveProjects = (projects) => {
  try {
    // Only save custom projects (not defaults)
    const customProjects = projects.filter(p => !DEFAULT_PROJECTS.includes(p));
    localStorage.setItem("mmis_projects", JSON.stringify(customProjects));
  } catch (err) {
    console.error("Error saving projects to localStorage:", err);
  }
};

const DEFAULT_INPUT_CLASS =
  "w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors";

export default function ProjectSelector({
  value = "",
  onChange,
  placeholder = "Select Project Name",
  required = false,
  className = "",
  inputClassName = "",
  showAddNew = true,
}) {
  const [projects, setProjects] = useState(getProjects());
  const [searchValue, setSearchValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const containerRef = useRef(null);

  // Filter projects based on search
  const filteredProjects = projects.filter((project) =>
    project.toLowerCase().includes(searchValue.toLowerCase().trim())
  );

  // Check if search value doesn't match any existing project
  const isNewProject = searchValue.trim() && 
    !projects.some(p => p.toLowerCase() === searchValue.trim().toLowerCase()) &&
    searchValue.trim() !== value;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync searchValue with value prop
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  const handleSelect = (project) => {
    setSearchValue(project);
    // Handle both form inputs (with name) and filter inputs (without name)
    if (onChange) {
      const event = { target: { name: "project_name", value: project } };
      onChange(event);
    }
    setShowDropdown(false);
  };

  const handleAddNew = () => {
    setShowAddModal(true);
    setNewProjectName(searchValue.trim());
  };

  const handleSaveNewProject = () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      alert("Please enter a project name");
      return;
    }

    // Check if project already exists
    if (projects.some(p => p.toLowerCase() === trimmedName.toLowerCase())) {
      alert("This project already exists");
      return;
    }

    // Add new project
    const updatedProjects = [...projects, trimmedName].sort();
    setProjects(updatedProjects);
    saveProjects(updatedProjects);

    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('projectsUpdated'));

    // Select the new project
    handleSelect(trimmedName);
    setShowAddModal(false);
    setNewProjectName("");
  };

  // Delete custom project handler
  const handleDeleteProject = (projectToDelete, e) => {
    e.stopPropagation(); // Prevent selecting the project when clicking delete
    
    // Check if it's a default project
    if (DEFAULT_PROJECTS.includes(projectToDelete)) {
      alert("Cannot delete default projects");
      return;
    }

    // Confirm deletion
    if (window.confirm(`Are you sure you want to delete the project "${projectToDelete}"?`)) {
      // Remove from projects list
      const updatedProjects = projects.filter(p => p !== projectToDelete);
      setProjects(updatedProjects);
      saveProjects(updatedProjects);

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('projectsUpdated'));

      // Clear selection if the deleted project was selected
      if (value === projectToDelete) {
        handleSelect("");
      }
    }
  };

  // Use the utility function
  const isCustomProject = isCustomProjectUtil;

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const handleInputBlur = () => {
    // Delay to allow click events on dropdown items
    setTimeout(() => setShowDropdown(false), 200);
  };

  const resolvedInputClass = inputClassName || className || DEFAULT_INPUT_CLASS;

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        type="text"
        value={searchValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        className={resolvedInputClass}
        required={required}
      />
      {showDropdown && (
        <div className="dropdown-menu absolute left-0 right-0 mt-1 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 transition-colors">
          {/* Clear option (for filters) */}
          {value && (
            <div
              onClick={() => handleSelect("")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-800 dark:text-gray-200 border-b dark:border-gray-600 transition-colors"
            >
              Clear Filter
            </div>
          )}
          
          {/* Add New option */}
          {showAddNew && isNewProject && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleAddNew();
              }}
              className="p-3 border-b dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer text-green-600 dark:text-green-400 font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add "{searchValue.trim()}" as new project
            </div>
          )}
          
          {/* Existing projects */}
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project) => (
              <div
                key={project}
                onClick={() => handleSelect(project)}
                className={`p-3 border-b dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer text-gray-800 dark:text-gray-200 transition-colors flex items-center justify-between group ${
                  value === project ? "bg-blue-100 dark:bg-blue-900/30" : ""
                }`}
              >
                <span className="flex-1">{project}</span>
                {isCustomProject(project) && (
                  <button
                    onClick={(e) => handleDeleteProject(project, e)}
                    className="ml-2 p-1 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete project"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-3 text-gray-500 dark:text-gray-400">
              {showAddNew && searchValue.trim() ? (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddNew();
                  }}
                  className="hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer text-green-600 dark:text-green-400 font-semibold transition-colors flex items-center gap-2 p-2 rounded"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add "{searchValue.trim()}" as new project
                </div>
              ) : (
                "No matches found"
              )}
            </div>
          )}
        </div>
      )}

      {/* Add New Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 transition-colors">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
              Add New Project
            </h3>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
              className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 transition-colors"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSaveNewProject();
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewProjectName("");
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 dark:text-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewProject}
                className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
              >
                Add Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

