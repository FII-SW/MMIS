import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";

export default function MaintenanceWorkPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const project = params.get("project");
  const testArea = params.get("test_area");

  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!project) {
      navigate("/dashboard/maintenance", { replace: true });
      return;
    }

    const loadFixtures = async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ project });
        if (testArea) {
          query.set("test_area", testArea);
        }
        const res = await API.get(`/fixtures/filter?${query.toString()}`);
        setFixtures(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error loading fixtures:", err);
        setFixtures([]);
        setError("Failed to load fixtures. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadFixtures();
  }, [project, testArea, navigate]);

  const filteredFixtures = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fixtures;
    return fixtures.filter((fx) => {
      const name = (fx.fixture_name || "").toLowerCase();
      const asset = (fx.asset_tag || "").toLowerCase();
      const serial = (fx.fixture_serial_number || "").toLowerCase();
      const id = String(fx.fixture_id || "");
      return name.includes(q) || asset.includes(q) || serial.includes(q) || id.includes(q);
    });
  }, [fixtures, search]);

  if (!project) {
    return null;
  }

  const handleBack = () => {
    if (testArea) {
      navigate(`/dashboard/maintenance/test-area?project=${encodeURIComponent(project)}`);
    } else {
      navigate("/dashboard/maintenance");
    }
  };

  if (loading) {
    return (
      <PageLoadingState
        title="Maintenance"
        onBack={handleBack}
        message="Loading fixtures..."
      />
    );
  }

  const locationLabel = testArea
    ? `${project} • ${testArea}`
    : project;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={handleBack} />

      <div className="max-w-6xl mx-auto px-4 pb-8">
        <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-1 text-lg">
          {locationLabel}
        </p>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          {fixtures.length} fixture{fixtures.length === 1 ? "" : "s"} for this location
        </p>

        {fixtures.length > 0 && (
          <div className="max-w-xl mx-auto mb-6">
            <input
              type="text"
              placeholder="Search fixtures by name, asset tag, or serial…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg shadow-sm"
            />
          </div>
        )}

        {error && (
          <p className="text-center text-red-600 dark:text-red-400 mb-4 text-sm">{error}</p>
        )}

        {filteredFixtures.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow p-8 text-center max-w-lg mx-auto">
            <div className="text-4xl mb-3">🔧</div>
            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
              {fixtures.length === 0 ? "No fixtures found" : "No matching fixtures"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {fixtures.length === 0
                ? `There are no fixtures registered for ${locationLabel}.`
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFixtures.map((fx) => (
              <button
                type="button"
                key={fx.fixture_id}
                onClick={() => {
                  const query = new URLSearchParams();
                  if (project) query.set("project", project);
                  if (testArea) query.set("test_area", testArea);
                  const qs = query.toString();
                  navigate(
                    `/dashboard/maintenance/fixture/${fx.fixture_id}${qs ? `?${qs}` : ""}`
                  );
                }}
                className="text-left bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-md p-5 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 leading-tight">
                    {fx.fixture_name}
                  </h3>
                  <span className="shrink-0 text-xs font-mono text-gray-400 dark:text-gray-500">
                    #{fx.fixture_id}
                  </span>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Project</dt>
                    <dd className="font-medium text-gray-800 dark:text-gray-200 text-right">
                      {fx.project_name || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Test area</dt>
                    <dd className="font-medium text-gray-800 dark:text-gray-200 text-right">
                      {fx.test_area || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Asset tag</dt>
                    <dd className="font-medium text-gray-800 dark:text-gray-200 text-right">
                      {fx.asset_tag || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Serial</dt>
                    <dd className="font-medium text-gray-800 dark:text-gray-200 text-right break-all">
                      {fx.fixture_serial_number || "—"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-medium">
                  View details →
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
