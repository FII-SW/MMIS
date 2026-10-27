// src/pages/RestockProjectPage.jsx
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { hasAdminAccess } from "../utils/auth";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import { getProjects } from "../utils/projects";

export default function RestockProjectPage() {
  const navigate = useNavigate();
  const [accessLevel, setAccessLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [projects, setProjects] = useState(getProjects());

  //Load access level from token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        // Token stores access level as "role" field
        setAccessLevel(hasAdminAccess(payload.role) ? "admin" : payload.role);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    setLoading(false);
  }, []);

  // Reload projects when component mounts or when projects are updated
  useEffect(() => {
    const handleProjectsUpdate = () => {
      setProjects(getProjects());
    };

    // Listen for custom event and storage changes
    window.addEventListener('projectsUpdated', handleProjectsUpdate);
    window.addEventListener('storage', handleProjectsUpdate);

    return () => {
      window.removeEventListener('projectsUpdated', handleProjectsUpdate);
      window.removeEventListener('storage', handleProjectsUpdate);
    };
  }, []);

  // Check if user is admin
  if (loading) {
    return (
      <PageLoadingState title="Restock" onBack={() => navigate("/dashboard")} />
    );
  }

  if (accessLevel !== "admin") {
    return <AccessDenied feature="the Restock feature" backTo="/dashboard" />;
  }

  // Filter projects based on search input
  const filteredProjects = projects.filter((project) =>
    project.toLowerCase().includes(searchInput.toLowerCase().trim())
  );

  // Projects that skip test area selection
  const skipTestAreaProjects = ["Hi-Lo", "Flying Probe", "Development"];

  // Handle project selection - skip test area for specific projects
  const handleProjectClick = (project) => {
    if (skipTestAreaProjects.includes(project)) {
      // Navigate directly to items page without test_area
      navigate(`/dashboard/restock/items?project=${encodeURIComponent(project)}`);
    } else {
      // Navigate to test area selection page
      navigate(`/dashboard/restock/test-area?project=${encodeURIComponent(project)}`);
    }
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Restock" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <p className="mb-3 text-center text-base font-semibold text-gray-700 dark:text-gray-300">
          Select project
        </p>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Search projects"
            aria-label="Search projects"
            className="w-full flex-1 rounded-lg border-2 border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button
            type="button"
            onClick={() => navigate("/dashboard/restock/project/add-new")}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            Add New Stock
          </button>
        </div>

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

