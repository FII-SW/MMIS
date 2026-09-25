import { useState } from "react";
import API from "../../api";
import { formatDate } from "./formatDate";

const REASON_SUGGESTIONS = ["Spare / not in use", "Down for repair", "Sent out for rework", "Line not running"];

export default function PMPauseControl({ fixtureId, status, isAdmin, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!status?.applicable) return null;

  const submit = async (paused) => {
    setSaving(true);
    setError("");
    try {
      await API.patch(`/maintenance/fixtures/${fixtureId}/pm-pause`, { paused, reason: paused ? reason : null });
      setEditing(false);
      setReason("");
      onChanged(paused);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not update PM pause.");
    } finally {
      setSaving(false);
    }
  };

  if (status.paused) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border-l-4 border-slate-500 bg-slate-100 p-4 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">⏸ PM is paused for this fixture</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {status.pause_reason || "No reason given"} · since {formatDate(status.paused_at)}
            {status.paused_by ? ` · by ${status.paused_by}` : ""}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            It won&apos;t show as overdue. When it goes back into production, resume PM so the schedule restarts.
          </p>
          {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={saving}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Resuming…" : "▶ Resume PM"}
          </button>
        )}
      </div>
    );
  }

  if (!isAdmin) return null;

  if (!editing) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-200 dark:hover:bg-slate-700"
          title="Use when the fixture is out of service so it doesn't show as overdue"
        >
          ⏸ Pause PM (fixture out of service)
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-gray-800">
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Pause PM for this fixture</p>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        The fixture will be left out of overdue counts and reminders until PM is resumed.
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {REASON_SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => setReason(text)}
            className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {text}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={255}
        placeholder="Reason (required)"
        className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
          }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:text-gray-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={saving || !reason.trim()}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Pausing…" : "Pause PM"}
        </button>
      </div>
    </div>
  );
}
