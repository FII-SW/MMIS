import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { getProjects } from "../utils/projects";
import { projectRequiresTestArea } from "../utils/inventoryRules";

export default function MaintenancePage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [projects, setProjects] = useState(getProjects());

  useEffect(() => {
    const handleProjectsUpdate = () => setProjects(getProjects());
    window.addEventListener("projectsUpdated", handleProjectsUpdate);
    window.addEventListener("storage", handleProjectsUpdate);
    return () => {
      window.removeEventListener("projectsUpdated", handleProjectsUpdate);
      window.removeEventListener("storage", handleProjectsUpdate);
    };
  }, []);

  const filteredProjects = projects.filter((project) =>
    project.toLowerCase().includes(searchInput.toLowerCase().trim())
  );

  const handleProjectClick = (project) => {
    const encoded = encodeURIComponent(project);
    if (!projectRequiresTestArea(project)) {
      navigate(`/dashboard/maintenance/work?project=${encoded}`);
      return;
    }
    navigate(`/dashboard/maintenance/test-area?project=${encoded}`);
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={() => navigate("/dashboard")} />

      <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-6 text-lg">
        Select Project Name
      </p>

      <div className="max-w-5xl mx-auto mb-6 px-8">
        <input
          type="text"
          placeholder="Project Names"
          className="w-full p-3 border-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg shadow-sm transition-all"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 justify-center mx-auto max-w-5xl px-4 sm:px-8">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-8">
            <p>No projects found matching &quot;{searchInput}&quot;</p>
          </div>
        ) : (
          filteredProjects.map((p) => (
            <div
              key={p}
              onClick={() => handleProjectClick(p)}
              className="border dark:border-gray-700 p-6 sm:p-8 text-center rounded-xl bg-white dark:bg-gray-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700 hover:shadow-lg transition-all shadow-md"
            >
              <span className="font-semibold text-gray-800 dark:text-gray-200 text-lg">{p}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
