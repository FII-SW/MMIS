import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import PMChecklistForm from "../components/maintenance/PMChecklistForm";
import PMHistory from "../components/maintenance/PMHistory";
import SparePartsHistory from "../components/maintenance/SparePartsHistory";
import FixtureDetailsPanel from "../components/maintenance/FixtureDetailsPanel";
import { formatDate } from "../components/maintenance/formatDate";
import { pmTypeLabel } from "../components/maintenance/pmTypes";
import { describeDue } from "../components/maintenance/pmStatus";
import PMStatusBadge from "../components/maintenance/PMStatusBadge";
import PMPauseControl from "../components/maintenance/PMPauseControl";
import PMIssuesList from "../components/maintenance/PMIssuesList";
import { MAINTENANCE_PROJECTS_URL, fixtureListUrl } from "../components/maintenance/links";
import { isAdminUser } from "../utils/auth";
import { useNotifications } from "../contexts/NotificationContext";

function PMStatusCard({ title, entry, onStart }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
        <PMStatusBadge state={entry?.state || "never"} label={describeDue(entry)} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-gray-500 dark:text-gray-400">Last done</dt>
        <dd className="text-gray-800 dark:text-gray-200">
          {formatDate(entry?.last_performed_at)}
          {entry?.covered_by && (
            <span className="ml-1 text-gray-500 dark:text-gray-400">(via {pmTypeLabel(entry.covered_by)})</span>
          )}
          {entry?.last_result === "failed" && (
            <span className="ml-1 font-semibold text-red-600 dark:text-red-400">(failed tasks)</span>
          )}
        </dd>
        <dt className="text-gray-500 dark:text-gray-400">Name</dt>
        <dd className="truncate text-gray-800 dark:text-gray-200">{entry?.last_performed_by || "—"}</dd>
        <dt className="text-gray-500 dark:text-gray-400">Next due</dt>
        <dd className="text-gray-800 dark:text-gray-200">{formatDate(entry?.next_due_at)}</dd>
      </dl>
      <button
        type="button"
        onClick={onStart}
        className="mt-3 w-full rounded-md bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
      >
        Record {title}
      </button>
    </div>
  );
}

export default function MaintenanceFixtureDetailPage() {
  const { fixture_id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const project = params.get("project");
  const testArea = params.get("test_area");
  const { addNotification } = useNotifications();

  const [fixture, setFixture] = useState(null);
  const [pmStatus, setPmStatus] = useState(null);
  const [pmRecords, setPmRecords] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [openIssues, setOpenIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAdmin = isAdminUser();

  const pmTypes = pmStatus?.pm_types || [];
  const tabs = [
    { id: "details", label: "Details" },
    ...pmTypes.map((type) => ({ id: type, label: pmTypeLabel(type) })),
    { id: "history", label: `PM History (${pmRecords.length})` },
    { id: "spare-parts", label: `Spare Parts (${spareParts.length})` },
  ];
  const requestedTab = params.get("tab") || "details";
  const activeTab = tabs.some((t) => t.id === requestedTab) ? requestedTab : "details";

  const setActiveTab = (tab) => {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    setParams(next, { replace: true });
  };

  const loadHistory = useCallback(() => {
    return Promise.all([
      API.get(`/maintenance/fixtures/${fixture_id}/pm-status`),
      API.get(`/maintenance/fixtures/${fixture_id}/pm-records`),
      API.get(`/maintenance/fixtures/${fixture_id}/spare-parts`),
      API.get("/maintenance/issues", { params: { fixture_id, status: "open" } }).catch(() => ({ data: [] })),
    ]).then(([statusRes, recordsRes, partsRes, issuesRes]) => {
      setPmStatus(statusRes.data);
      setPmRecords(recordsRes.data || []);
      setSpareParts(partsRes.data || []);
      setOpenIssues(issuesRes.data || []);
    });
  }, [fixture_id]);

  const refresh = async () => {
    try {
      await loadHistory();
    } catch (err) {
      console.error("Error refreshing PM data:", err);
    }
  };

  useEffect(() => {
    if (!fixture_id) return;

    setLoading(true);
    setError("");
    API.get(`/fixtures/${fixture_id}`)
      .then((res) => {
        setFixture(res.data);
        return loadHistory();
      })
      .catch((err) => {
        console.error("Error loading fixture:", err);
        setError(err?.response?.status === 404 ? "Fixture not found." : "Failed to load fixture details.");
      })
      .finally(() => setLoading(false));
  }, [fixture_id, loadHistory]);

  const handleBack = () => {
    navigate(project ? fixtureListUrl(project, testArea) : MAINTENANCE_PROJECTS_URL);
  };

  const handleRequestPart = () => {
    const query = new URLSearchParams();
    query.set("project", fixture.project_name || project || "");
    const area = fixture.test_area || testArea;
    if (area) query.set("test_area", area);
    query.set("fixture_id", String(fixture.fixture_id));
    query.set("from", "maintenance");
    navigate(`/dashboard/request/search?${query.toString()}`);
  };

  const handlePMSaved = async (record) => {
    addNotification(`${pmTypeLabel(record.pm_type)} recorded for ${fixture.fixture_name} (${record.overall_result.toUpperCase()}).`);
    await refresh();
    setActiveTab("history");
  };

  const handleRecordChanged = async () => {
    addNotification(`PM record updated for ${fixture.fixture_name}.`);
    await refresh();
  };

  const handlePauseChanged = async (paused) => {
    addNotification(`PM ${paused ? "paused" : "resumed"} for ${fixture.fixture_name}.`);
    await refresh();
  };

  if (loading) {
    return <PageLoadingState title="Maintenance" onBack={handleBack} message="Loading fixture details..." />;
  }

  if (error || !fixture) {
    return (
      <div className="min-h-screen bg-transparent transition-colors">
        <PageHeaderWithBack title="Maintenance" onBack={handleBack} />
        <p className="mt-10 text-center text-red-600 dark:text-red-400">{error || "Fixture not found."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Maintenance" onBack={handleBack} />

      <p className="mb-5 px-4 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">
        Project: <span className="text-blue-600 dark:text-blue-400">{fixture.project_name || project}</span>
        {(fixture.test_area || testArea) && (
          <>
            {" "}
            — Test Area: <span className="text-blue-600 dark:text-blue-400">{fixture.test_area || testArea}</span>
          </>
        )}
        {" "}
        — Fixture: <span className="text-blue-600 dark:text-blue-400">{fixture.fixture_name}</span>
      </p>

      <div className="mx-auto max-w-5xl space-y-4 px-2 pb-8">
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-gray-800 dark:text-gray-100">{fixture.fixture_name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {fixture.project_name} · {fixture.test_area} · Asset {fixture.asset_tag || "—"}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                {fixture.production_line || "Line not set"}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {fixture.manufacturer || "Manufacturer not set"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestPart}
            className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
          >
            Request spare part
          </button>
        </div>

        <PMPauseControl
          fixtureId={fixture.fixture_id}
          status={pmStatus}
          isAdmin={isAdmin}
          onChanged={handlePauseChanged}
        />

        {openIssues.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-orange-300 bg-white shadow-sm dark:border-orange-800 dark:bg-gray-800">
            <div className="border-b border-orange-200 bg-orange-50 px-4 py-2.5 dark:border-orange-800 dark:bg-orange-900/20">
              <p className="text-sm font-bold text-orange-800 dark:text-orange-200">
                ⚠ {openIssues.length} open issue{openIssues.length === 1 ? "" : "s"} from failed PM tasks
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300">
                Mark each one fixed when it&apos;s repaired. It also closes automatically when the task passes in a later PM.
              </p>
            </div>
            <PMIssuesList
              issues={openIssues}
              onResolved={(issue) => {
                setOpenIssues((prev) => prev.filter((i) => i.issue_id !== issue.issue_id));
                addNotification(`Issue fixed on ${fixture.fixture_name}: ${issue.task}`);
              }}
            />
          </div>
        )}

        {pmTypes.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pmTypes.map((type) => (
              <PMStatusCard
                key={type}
                title={pmTypeLabel(type)}
                entry={pmStatus.status[type]}
                onStart={() => setActiveTab(type)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            PM checklists are configured for FBT (weekly, biweekly) and ICT (monthly) fixtures only.
          </p>
        )}

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                    : "border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === "details" && (
              <FixtureDetailsPanel
                fixture={fixture}
                onUpdated={(updated) => {
                  setFixture(updated);
                  addNotification(`Updated production info for ${updated.fixture_name}.`);
                }}
              />
            )}
            {pmTypes.includes(activeTab) && (
              <PMChecklistForm
                key={activeTab}
                fixture={fixture}
                pmType={activeTab}
                lastEntry={pmStatus?.status?.[activeTab]}
                onSaved={handlePMSaved}
              />
            )}
            {activeTab === "history" && (
              <PMHistory records={pmRecords} fixture={fixture} onChanged={handleRecordChanged} />
            )}
            {activeTab === "spare-parts" && <SparePartsHistory entries={spareParts} />}
          </div>
        </div>
      </div>
    </div>
  );
}
