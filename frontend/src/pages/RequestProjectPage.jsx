// src/pages/RequestProjectPage.jsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { getProjects } from "../utils/projects";

export default function RequestProjectPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [projects, setProjects] = useState(getProjects());

  useEffect(() => {
    const handleProjectsUpdate = () => {
      setProjects(getProjects());
    };

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

  const skipTestAreaProjects = ["Hi-Lo", "Flying Probe", "Development"];

  const handleProjectClick = (project) => {
    if (skipTestAreaProjects.includes(project)) {
      navigate(`/dashboard/request/search?project=${encodeURIComponent(project)}`);
    } else {
      navigate(`/dashboard/request/test-area?project=${encodeURIComponent(project)}`);
    }
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Request" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <p className="mb-3 text-center text-base font-semibold text-gray-700 dark:text-gray-300">
          Select project
        </p>

        <input
          type="text"
          placeholder="Search projects"
          aria-label="Search projects"
          className="mb-3 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>No projects found matching &quot;{searchInput}&quot;</p>
            </div>
          ) : (
            filteredProjects.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => handleProjectClick(p)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-3 text-center text-sm font-semibold leading-snug text-gray-800 shadow-sm transition-all hover:bg-blue-50 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <span className="line-clamp-2">{p}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
