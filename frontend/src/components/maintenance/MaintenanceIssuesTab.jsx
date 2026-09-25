import { useCallback, useEffect, useMemo, useState } from "react";
import API from "../../api";
import PMIssuesList from "./PMIssuesList";
import useStickyState from "./useStickyState";

const STATUS_OPTIONS = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Fixed" },
  { id: "all", label: "All" },
];

export default function MaintenanceIssuesTab({ onCountChange }) {
  const [status, setStatus] = useStickyState("mmis:pm-issues:status", "open");
  const [search, setSearch] = useState("");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return API.get("/maintenance/issues", { params: { status } })
      .then((res) => setIssues(res.data || []))
      .catch((err) => {
        console.error("Error loading PM issues:", err);
        setError("Failed to load PM issues.");
      })
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter((issue) =>
      [issue.fixture_name, issue.task, issue.project_name, issue.test_area, issue.production_line, issue.found_by].some(
        (value) => (value || "").toLowerCase().includes(q)
      )
    );
  }, [issues, search]);

  const handleResolved = (issue) => {
    if (status === "open") {
      setIssues((prev) => prev.filter((i) => i.issue_id !== issue.issue_id));
      onCountChange?.(-1);
    } else {
      load();
      onCountChange?.(-1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-l-4 border-orange-500 bg-orange-50 p-4 text-sm text-orange-900 dark:bg-orange-900/20 dark:text-orange-200">
        Every failed PM task becomes an issue here. It stays open until someone marks it fixed or the same task passes in a later PM.
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatus(opt.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                status === opt.id
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fixture, task, project, line…"
          className="flex-1 rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </div>

      {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-xl border bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading issues…</p>
        ) : (
          <PMIssuesList
            issues={visible}
            showFixture
            onResolved={handleResolved}
            emptyText={status === "open" ? "No open issues. Every failed task has been fixed. ✅" : "No issues found."}
          />
        )}
      </div>
    </div>
  );
}
