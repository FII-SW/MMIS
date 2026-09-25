import { useEffect, useMemo, useState } from "react";
import API from "../../api";
import { formatDateTime } from "./formatDate";
import { describeDue } from "./pmStatus";
import PMPartsPicker from "./PMPartsPicker";

const RESULT_OPTIONS = [
  { value: "passed", label: "Passed", active: "bg-green-600 text-white border-green-600" },
  { value: "failed", label: "Failed", active: "bg-red-600 text-white border-red-600" },
  { value: "na", label: "N/A", active: "bg-gray-500 text-white border-gray-500" },
];

function readDraft(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export default function PMChecklistForm({ fixture, pmType, lastEntry, onSaved }) {
  const draftKey = `mmis:pm-draft:${fixture.fixture_id}:${pmType}`;
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [results, setResults] = useState({});
  const [notes, setNotes] = useState("");
  const [partsReplaced, setPartsReplaced] = useState("");
  const [stockParts, setStockParts] = useState([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    setResults({});
    API.get(`/maintenance/checklists/${pmType}`, { params: { test_area: fixture.test_area } })
      .then((res) => {
        setChecklist(res.data);
        const draft = readDraft(draftKey);
        if (draft) {
          const validIds = new Set(res.data.items.map((item) => item.id));
          const restored = Object.fromEntries(
            Object.entries(draft.results || {}).filter(([id]) => validIds.has(id))
          );
          setResults(restored);
          setNotes(draft.notes || "");
          setPartsReplaced(draft.partsReplaced || "");
          setStockParts(Array.isArray(draft.stockParts) ? draft.stockParts : []);
          setDraftRestored(
            Object.keys(restored).length > 0 ||
              Boolean(draft.notes || draft.partsReplaced || draft.stockParts?.length)
          );
        }
      })
      .catch((err) => {
        setChecklist(null);
        setLoadError(err?.response?.data?.detail || "Failed to load checklist.");
      })
      .finally(() => setLoading(false));
  }, [pmType, fixture.test_area, draftKey]);

  useEffect(() => {
    if (!checklist) return;
    const hasContent =
      Object.keys(results).length > 0 || notes.trim() || partsReplaced.trim() || stockParts.length > 0;
    if (hasContent) {
      localStorage.setItem(draftKey, JSON.stringify({ results, notes, partsReplaced, stockParts }));
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [checklist, draftKey, results, notes, partsReplaced, stockParts]);

  const resetForm = () => {
    setResults({});
    setNotes("");
    setPartsReplaced("");
    setStockParts([]);
    setDraftRestored(false);
    setSubmitError("");
    localStorage.removeItem(draftKey);
  };

  const sections = useMemo(() => {
    if (!checklist) return [];
    const grouped = [];
    checklist.items.forEach((item) => {
      let group = grouped.find((g) => g.name === item.section);
      if (!group) {
        group = { name: item.section, items: [] };
        grouped.push(group);
      }
      group.items.push(item);
    });
    return grouped;
  }, [checklist]);

  const totalItems = checklist?.items.length || 0;
  const answered = Object.keys(results).length;
  const hasFailure = Object.values(results).includes("failed");

  const markAllPassed = () => {
    if (!checklist) return;
    setResults(Object.fromEntries(checklist.items.map((item) => [item.id, "passed"])));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (answered < totalItems) {
      setSubmitError(`Select a result for every task (${totalItems - answered} remaining).`);
      return;
    }
    if (hasFailure && !notes.trim()) {
      setSubmitError("Notes are required when any task failed.");
      return;
    }

    const payload = {
      pm_type: pmType,
      results: Object.entries(results).map(([item_id, result]) => ({ item_id, result })),
      notes: notes.trim() || null,
      parts_replaced: partsReplaced.trim() || null,
      parts: stockParts,
    };
    const url = `/maintenance/fixtures/${fixture.fixture_id}/pm-records`;

    setSubmitting(true);
    try {
      let res;
      try {
        res = await API.post(url, payload);
      } catch (err) {
        if (err?.response?.status !== 409) throw err;
        const confirmed = window.confirm(`${err.response.data?.detail}\n\nRecord it again anyway?`);
        if (!confirmed) return;
        res = await API.post(url, { ...payload, confirm_duplicate: true });
      }
      resetForm();
      onSaved?.(res.data);
    } catch (err) {
      setSubmitError(err?.response?.data?.detail || "Failed to save PM record.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Loading checklist…</p>;
  }

  if (loadError || !checklist) {
    return (
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
        {loadError || "Checklist not available."}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">{checklist.title}</p>
        <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">{checklist.summary}</p>
        {checklist.reference && (
          <p className="mt-2 inline-block rounded bg-orange-200 px-2 py-0.5 text-xs font-semibold text-orange-900 dark:bg-orange-900/50 dark:text-orange-200">
            {checklist.reference}
          </p>
        )}
      </div>

      {lastEntry && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {lastEntry.last_performed_at
            ? `Last done ${formatDateTime(lastEntry.last_performed_at)} by ${lastEntry.last_performed_by || "Unknown"} · ${describeDue(lastEntry)}`
            : "This PM has never been recorded for this fixture."}
        </p>
      )}

      {draftRestored && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
          <span>Unsaved progress was restored from your last visit.</span>
          <button type="button" onClick={resetForm} className="font-semibold hover:underline">
            Start over
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {answered} of {totalItems} tasks recorded
            {hasFailure && <span className="ml-2 font-semibold text-red-600 dark:text-red-400">· failures need notes</span>}
          </p>
          <div className="flex gap-3">
            {answered > 0 && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-gray-500 hover:underline dark:text-gray-400"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={markAllPassed}
              className="text-xs font-medium text-green-700 hover:underline dark:text-green-400"
            >
              Mark all passed
            </button>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full transition-all ${hasFailure ? "bg-red-500" : "bg-green-500"}`}
            style={{ width: `${totalItems ? (answered / totalItems) * 100 : 0}%` }}
          />
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.name} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            {section.name}
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {section.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-800 dark:text-gray-200">{item.task}</span>
                <div className="flex shrink-0 gap-1">
                  {RESULT_OPTIONS.map((opt) => {
                    const selected = results[item.id] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setResults((prev) => ({ ...prev, [item.id]: opt.value }))}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? opt.active
                            : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {checklist.note && <p className="text-xs text-gray-600 dark:text-gray-400">{checklist.note}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            Notes {hasFailure && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Repairs, adjustments, or issues found"
            className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            Parts replaced
          </label>
          <textarea
            value={partsReplaced}
            onChange={(e) => setPartsReplaced(e.target.value)}
            rows={3}
            placeholder="Parts not tracked in MMIS inventory"
            className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <PMPartsPicker fixture={fixture} parts={stockParts} onChange={setStockParts} />

      {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-green-700 disabled:opacity-60 dark:bg-green-700 dark:hover:bg-green-600"
        >
          {submitting ? "Saving…" : `Submit ${checklist.label}`}
        </button>
      </div>
    </form>
  );
}
