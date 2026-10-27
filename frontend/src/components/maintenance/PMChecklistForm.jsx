import { useEffect, useMemo, useState } from "react";
import API from "../../api";
import { apiErrorMessage } from "../../utils/apiError";
import { formatDateTime } from "./formatDate";
import { describeDue } from "./pmStatus";
import PMPartsPicker from "./PMPartsPicker";
import { COMMODITY_QUESTION, DOWNTIME_QUESTION, NO_COMMODITY, formatMinutes } from "./pmDetails";

const EMPTY_DETAILS = { maintenanceType: "", activationCounter: "", commodityChoice: "", commodityText: "", downtime: "" };
const WHOLE_NUMBER = /^\d+$/;
const INPUT_CLASS =
  "w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white";

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
  const [details, setDetails] = useState(EMPTY_DETAILS);
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [reloadToken, setReloadToken] = useState(0);

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
          const restoredDetails = { ...EMPTY_DETAILS, ...(draft.details || {}) };
          setDetails(restoredDetails);
          setDraftRestored(
            Object.keys(restored).length > 0 ||
              Boolean(draft.notes || draft.partsReplaced || draft.stockParts?.length) ||
              Object.values(restoredDetails).some(Boolean)
          );
        }
      })
      .catch((err) => {
        setChecklist(null);
        const status = err?.response?.status;
        if (status === 404) {
          setLoadError(
            apiErrorMessage(
              err,
              `No ${pmType} checklist is configured for ${fixture.test_area || "this test area"}.`
            )
          );
        } else if (status >= 500 || !err?.response) {
          setLoadError(
            "Could not load the checklist from the server. Pull the latest code, restart mmis-backend, then try again."
          );
        } else {
          setLoadError(apiErrorMessage(err, "Failed to load checklist."));
        }
      })
      .finally(() => setLoading(false));
  }, [pmType, fixture.test_area, draftKey, reloadToken]);

  useEffect(() => {
    if (!checklist) return;
    const hasContent =
      Object.keys(results).length > 0 ||
      notes.trim() ||
      partsReplaced.trim() ||
      stockParts.length > 0 ||
      Object.values(details).some(Boolean);
    if (hasContent) {
      localStorage.setItem(draftKey, JSON.stringify({ results, notes, partsReplaced, stockParts, details }));
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [checklist, draftKey, results, notes, partsReplaced, stockParts, details]);

  const setDetail = (field, value) => setDetails((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setResults({});
    setNotes("");
    setPartsReplaced("");
    setStockParts([]);
    setDetails(EMPTY_DETAILS);
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
  const requiresDetails = Boolean(checklist?.requires_details);

  const detailsError = () => {
    if (!details.maintenanceType) return "Select the maintenance type: Preventive or Corrective.";
    if (!WHOLE_NUMBER.test(details.activationCounter.trim())) return "Enter the activation counter (whole number).";
    if (!details.commodityChoice) return "Answer whether any commodity was replaced.";
    if (details.commodityChoice === "yes" && !details.commodityText.trim())
      return "Describe the condition and location of the replaced commodity.";
    if (!WHOLE_NUMBER.test(details.downtime.trim())) return "Enter the downtime in minutes (0 if there was none).";
    return "";
  };

  const markAllPassed = () => {
    if (!checklist) return;
    setResults(Object.fromEntries(checklist.items.map((item) => [item.id, "passed"])));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    const missingDetail = requiresDetails ? detailsError() : "";
    if (missingDetail) {
      setSubmitError(missingDetail);
      return;
    }
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
      ...(requiresDetails && {
        maintenance_type: details.maintenanceType,
        activation_counter: Number(details.activationCounter.trim()),
        commodity_replacement: details.commodityChoice === "yes" ? details.commodityText.trim() : NO_COMMODITY,
        downtime_minutes: Number(details.downtime.trim()),
      }),
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
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
          {loadError || "Checklist not available."}
        </p>
        <button
          type="button"
          onClick={() => setReloadToken((n) => n + 1)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
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

      {requiresDetails && (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
            Maintenance details
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
            <label className="block md:col-span-2 md:max-w-sm">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Maintenance type <span className="text-red-500">*</span>
              </span>
              <select
                value={details.maintenanceType}
                onChange={(e) => setDetail("maintenanceType", e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Select…</option>
                {(checklist.maintenance_types || []).map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Activation counter <span className="text-red-500">*</span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={details.activationCounter}
                onChange={(e) => setDetail("activationCounter", e.target.value)}
                placeholder="Number shown on the fixture counter"
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {DOWNTIME_QUESTION} (minutes) <span className="text-red-500">*</span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={details.downtime}
                onChange={(e) => setDetail("downtime", e.target.value)}
                placeholder="0 if there was no downtime"
                className={INPUT_CLASS}
              />
              {WHOLE_NUMBER.test(details.downtime.trim()) && Number(details.downtime) >= 60 && (
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  = {formatMinutes(Number(details.downtime))}
                </span>
              )}
            </label>
            <div className="md:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {COMMODITY_QUESTION} <span className="text-red-500">*</span>
              </span>
              <div className="flex gap-1">
                {[
                  { value: "no", label: "No commodity replaced" },
                  { value: "yes", label: "Yes, a commodity was replaced" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDetail("commodityChoice", opt.value)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      details.commodityChoice === opt.value
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {details.commodityChoice === "yes" && (
                <textarea
                  value={details.commodityText}
                  onChange={(e) => setDetail("commodityText", e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Which commodity, its condition, and where on the fixture (e.g. Pogo pin worn out, DIMM slot 3)"
                  className={`mt-2 ${INPUT_CLASS}`}
                  autoFocus
                />
              )}
            </div>
          </div>
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

      <div className={`grid grid-cols-1 gap-3 ${requiresDetails ? "" : "md:grid-cols-2"}`}>
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
        {!requiresDetails && (
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
        )}
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
