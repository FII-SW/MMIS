import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api";
import { formatDate, formatDateTime } from "./formatDate";
import { fixtureDetailUrl } from "./links";
import { pmTypeLabel } from "./pmTypes";

function daysOpen(createdAt) {
  if (!createdAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
}

function IssueRow({ issue, showFixture, onResolved }) {
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const age = daysOpen(issue.created_at);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await API.post(`/maintenance/issues/${issue.issue_id}/resolve`, { note });
      onResolved(issue);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not resolve the issue.");
      setSaving(false);
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {showFixture && (
            <button
              type="button"
              onClick={() => navigate(fixtureDetailUrl(issue, { tab: "history" }))}
              className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
            >
              {issue.fixture_name || `Fixture #${issue.fixture_id}`}
            </button>
          )}
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{issue.task}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {showFixture && `${issue.project_name} · ${issue.test_area}${issue.production_line ? ` · ${issue.production_line}` : ""} · `}
            Failed in {pmTypeLabel(issue.pm_type)} on {formatDate(issue.created_at)}
            {issue.found_by ? ` by ${issue.found_by}` : ""}
          </p>
          {issue.status !== "open" && (
            <p className="mt-1 text-xs text-green-700 dark:text-green-400">
              {issue.status === "voided" ? "Voided" : "Fixed"} {formatDateTime(issue.resolved_at)}
              {issue.resolved_by ? ` by ${issue.resolved_by}` : ""}: {issue.resolution_note}
            </p>
          )}
        </div>
        {issue.status === "open" && (
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                age >= 7
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
              }`}
            >
              Open {age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"}`}
            </span>
            {!resolving && (
              <button
                type="button"
                onClick={() => setResolving(true)}
                className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
              >
                Mark fixed
              </button>
            )}
          </div>
        )}
      </div>
      {resolving && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was done? e.g. Replaced SATA interposer"
            className="flex-1 rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResolving(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || !note.trim()}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}

export default function PMIssuesList({ issues, showFixture = false, onResolved, emptyText = "No open issues." }) {
  if (!issues.length) {
    return <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {issues.map((issue) => (
        <IssueRow key={issue.issue_id} issue={issue} showFixture={showFixture} onResolved={onResolved} />
      ))}
    </ul>
  );
}
