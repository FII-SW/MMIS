import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";

function Field({ label, value }) {
  return (
    <div>
      <label className="block mb-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 break-words">
        {value || "—"}
      </div>
    </div>
  );
}

export default function MaintenanceFixtureDetailPage() {
  const { fixture_id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const project = params.get("project");
  const testArea = params.get("test_area");

  const [fixture, setFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fixture_id) return;

    setLoading(true);
    setError("");
    API.get(`/fixtures/${fixture_id}`)
      .then((res) => setFixture(res.data))
      .catch((err) => {
        console.error("Error loading fixture:", err);
        setFixture(null);
        setError("Failed to load fixture details.");
      })
      .finally(() => setLoading(false));
  }, [fixture_id]);

  const handleBack = () => {
    const query = new URLSearchParams();
    if (project) query.set("project", project);
    if (testArea) query.set("test_area", testArea);
    const qs = query.toString();
    navigate(`/dashboard/maintenance/work${qs ? `?${qs}` : ""}`);
  };

  if (loading) {
    return (
      <PageLoadingState
        title="Maintenance"
        onBack={handleBack}
        message="Loading fixture details..."
      />
    );
  }

  if (error || !fixture) {
    return (
      <div className="min-h-screen bg-transparent transition-colors">
        <PageHeaderWithBack title="Maintenance" onBack={handleBack} />
        <p className="text-center text-red-600 dark:text-red-400 mt-10">
          {error || "Fixture not found."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={handleBack} />

      <div className="max-w-2xl mx-auto px-4 pb-8">
        <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-1 text-lg">
          Fixture Details
        </p>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
          {fixture.fixture_name}
        </p>

        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow p-6 space-y-5">
          <Field label="Fixture ID" value={fixture.fixture_id} />
          <Field label="Fixture Name" value={fixture.fixture_name} />
          <Field label="Project Name" value={fixture.project_name} />
          <Field label="Test Area" value={fixture.test_area} />
          <Field label="Asset Tag" value={fixture.asset_tag} />
          <Field label="Serial Number" value={fixture.fixture_serial_number} />
        </div>
      </div>
    </div>
  );
}
