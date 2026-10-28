import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PMStatusLine from "../components/maintenance/PMStatusLine";
import { FIXTURE_MAINTENANCE_TITLE, fixtureListUrl, testAreaUrl } from "../components/maintenance/links";
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
      <PageHeaderWithBack title={FIXTURE_MAINTENANCE_TITLE} onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-5xl px-4 pb-6 sm:px-6">
        <p className="mb-0.5 text-center text-base font-semibold text-gray-700 dark:text-gray-300">
          Select a project
        </p>
        <p className="mb-3 text-center text-xs text-gray-500 dark:text-gray-400">
          Red border = overdue PMs. Open overdue to filter those fixtures.
        </p>

        <input
          type="text"
          placeholder="Search projects"
          aria-label="Search projects"
          className="mb-4 w-full rounded-lg border-2 border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm transition-all dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProjects.length === 0 ? (
            <div className="col-span-full py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>No projects found matching &quot;{search}&quot;</p>
            </div>
          ) : (
            filteredProjects.map((project) => {
              const counts = countsByProject[project];
              const overdue = counts?.overdue || 0;
              return (
                <div
                  key={project}
                  className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border bg-white px-3 py-3.5 text-center shadow-sm dark:bg-gray-800 ${
                    overdue > 0
                      ? "border-red-300 dark:border-red-800"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openProject(project)}
                    className="flex w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 py-0.5 transition-all hover:bg-blue-50 dark:hover:bg-gray-700"
                  >
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-gray-800 dark:text-gray-200">
                      {project}
                    </span>
                    {locations && (
                      <>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {counts?.fixtures || 0} PM fixture{(counts?.fixtures || 0) === 1 ? "" : "s"}
                        </span>
                        <PMStatusLine counts={counts} />
                      </>
                    )}
                  </button>
                  {overdue > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate(fixtureListUrl(project, null, "overdue"))}
                      className="text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400"
                    >
                      Open {overdue} overdue
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
