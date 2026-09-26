import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PMStatusLine from "../components/maintenance/PMStatusLine";
import { fixtureListUrl, testAreaUrl } from "../components/maintenance/links";
import { getProjects } from "../utils/projects";
import { projectRequiresTestArea } from "../utils/inventoryRules";

const COUNT_FIELDS = ["fixtures", "overdue", "due_soon", "never", "ok", "paused"];

export default function MaintenanceProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState(getProjects());
  const [locations, setLocations] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const update = () => setProjects(getProjects());
    window.addEventListener("projectsUpdated", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("projectsUpdated", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  useEffect(() => {
    API.get("/maintenance/summary")
      .then((res) => setLocations(res.data?.locations || []))
      .catch((err) => {
        console.error("Error loading PM summary:", err);
        setLocations([]);
      });
  }, []);

  const countsByProject = useMemo(() => {
    const counts = {};
    (locations || []).forEach((loc) => {
      const key = loc.project_name || "";
      counts[key] ||= Object.fromEntries(COUNT_FIELDS.map((field) => [field, 0]));
      COUNT_FIELDS.forEach((field) => {
        counts[key][field] += loc[field] || 0;
      });
    });
    return counts;
  }, [locations]);

  const q = search.trim().toLowerCase();
  const filteredProjects = projects.filter((project) => project.toLowerCase().includes(q));

  const openProject = (project) =>
    navigate(projectRequiresTestArea(project) ? testAreaUrl(project) : fixtureListUrl(project));

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={() => navigate("/dashboard")} />

      <p className="mb-6 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">
        Select Project Name
      </p>

      <div className="mx-auto mb-6 max-w-5xl px-8">
        <input
          type="text"
          placeholder="Project Names"
          className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 shadow-sm transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-2 justify-center gap-6 px-8 pb-8 md:grid-cols-3 lg:grid-cols-4">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full py-8 text-center text-gray-500 dark:text-gray-400">
            <p>No projects found matching &quot;{search}&quot;</p>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <button
              key={project}
              type="button"
              onClick={() => openProject(project)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-white p-8 text-center shadow-md transition-all hover:bg-blue-100 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">{project}</span>
              {locations && <PMStatusLine counts={countsByProject[project]} />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
