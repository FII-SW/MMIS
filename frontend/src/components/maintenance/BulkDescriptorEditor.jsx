import { useMemo, useState } from "react";
import API from "../../api";
import { useFixtureDescriptorOptions } from "../FixtureDescriptorFields";
import { apiErrorMessage } from "../../utils/apiError";
import { isOnHold } from "../../utils/fixtureLifecycle";
import FixtureLifecycleFields from "./FixtureLifecycleFields";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white";

/** Keep each request small so proxies / workers don't time out on large fixture lists. */
const SAVE_CHUNK_SIZE = 40;
const FIELD_KEYS = [
  "asset_tag",
  "fixture_serial_number",
  "manufacturer",
  "production_line",
  "lifecycle_status",
  "hold_reason",
];

function clean(value) {
  return (value || "").trim();
}

function draftFromFixture(fx) {
  return {
    asset_tag: fx.asset_tag || "",
    fixture_serial_number: fx.fixture_serial_number || "",
    manufacturer: fx.manufacturer || "",
    production_line: fx.production_line || "",
    lifecycle_status: fx.lifecycle_status || "production",
    hold_reason: fx.hold_reason || "",
  };
}

export default function BulkDescriptorEditor({ fixtures, onClose, onSaved }) {
  const options = useFixtureDescriptorOptions();
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(fixtures.map((fx) => [fx.fixture_id, draftFromFixture(fx)]))
  );
  const [selected, setSelected] = useState(() => new Set());
  const [applyManufacturer, setApplyManufacturer] = useState("");
  const [applyLine, setApplyLine] = useState("");
  const [applyStatus, setApplyStatus] = useState("");
  const [applyHold, setApplyHold] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState("");
  const [error, setError] = useState("");

  const draftFor = (fx) => drafts[fx.fixture_id] || draftFromFixture(fx);

  const changed = useMemo(
    () =>
      fixtures.filter((fx) => {
        const draft = drafts[fx.fixture_id];
        if (!draft) return false;
        return FIELD_KEYS.some((key) => clean(draft[key]) !== clean(fx[key] || (key === "lifecycle_status" ? "production" : "")));
      }),
    [fixtures, drafts]
  );

  const selectedCount = fixtures.filter((fx) => selected.has(fx.fixture_id)).length;
  const allSelected = fixtures.length > 0 && selectedCount === fixtures.length;

  const setField = (fx, field, value) =>
    setDrafts((prev) => {
      const current = { ...(prev[fx.fixture_id] || draftFor(fx)), [field]: value };
      if (field === "lifecycle_status" && value !== "on_hold") current.hold_reason = "";
      return { ...prev, [fx.fixture_id]: current };
    });

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(fixtures.map((fx) => fx.fixture_id)));

  const applyToSelected = () => {
    if (selectedCount === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      fixtures
        .filter((fx) => selected.has(fx.fixture_id))
        .forEach((fx) => {
          const current = next[fx.fixture_id] || draftFor(fx);
          const status = applyStatus.trim() ? applyStatus : current.lifecycle_status;
          next[fx.fixture_id] = {
            ...current,
            manufacturer: applyManufacturer.trim() ? applyManufacturer : current.manufacturer,
            production_line: applyLine.trim() ? applyLine : current.production_line,
            lifecycle_status: status,
            hold_reason:
              status === "on_hold"
                ? applyHold.trim()
                  ? applyHold
                  : current.hold_reason
                : "",
          };
        });
      return next;
    });
  };

  const handleCancel = () => {
    if (changed.length > 0 && !window.confirm(`Discard ${changed.length} unsaved change(s)?`)) return;
    onClose();
  };

  const handleSave = async () => {
    if (changed.length === 0) return;
    const missingHold = changed.filter(
      (fx) => isOnHold(drafts[fx.fixture_id]?.lifecycle_status) && !clean(drafts[fx.fixture_id]?.hold_reason)
    );
    if (missingHold.length > 0) {
      setError(
        `Select a hold location (Warehouse, PM, or N/A) for: ${missingHold
          .slice(0, 5)
          .map((fx) => fx.fixture_name)
          .join(", ")}${missingHold.length > 5 ? "…" : ""}`
      );
      return;
    }
    setSaving(true);
    setError("");
    setSaveProgress("");
    const updates = changed
      .map((fx) => {
        const draft = drafts[fx.fixture_id];
        const patch = { fixture_id: fx.fixture_id };
        FIELD_KEYS.forEach((key) => {
          const next = clean(draft[key]);
          const prev = clean(fx[key] || (key === "lifecycle_status" ? "production" : ""));
          if (next !== prev) {
            if (key === "lifecycle_status") patch[key] = next || "production";
            else if (key === "hold_reason") patch[key] = next || null;
            else patch[key] = next || null;
          }
        });
        // If status moved off hold, always clear hold_reason.
        if (patch.lifecycle_status && patch.lifecycle_status !== "on_hold") {
          patch.hold_reason = null;
        }
        return patch;
      })
      .filter((row) => Object.keys(row).length > 1);
    try {
      const total = updates.length;
      for (let i = 0; i < updates.length; i += SAVE_CHUNK_SIZE) {
        const chunk = updates.slice(i, i + SAVE_CHUNK_SIZE);
        const done = Math.min(i + chunk.length, total);
        setSaveProgress(`Saving ${done} of ${total}…`);
        await API.patch("/fixtures/bulk-descriptors", { updates: chunk });
      }
      onSaved(updates);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save changes."));
    } finally {
      setSaving(false);
      setSaveProgress("");
    }
  };

  const canApply =
    selectedCount > 0 &&
    (applyLine.trim() ||
      applyManufacturer.trim() ||
      applyStatus.trim() ||
      (applyStatus === "on_hold" && applyHold.trim()));

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm dark:border-blue-800 dark:bg-gray-800">
      <datalist id="bulk-manufacturer-options">
        {options.manufacturers.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="bulk-line-options">
        {options.production_lines.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>

      <div className="flex flex-col gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Edit fixture info</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Set Status (Production / On Hold / Development). On Hold needs Warehouse, PM, or N/A. On Hold and Development are not shown as PM overdue.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || changed.length === 0}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving
                ? saveProgress || "Saving…"
                : `Save ${changed.length} change${changed.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-900/40">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            {selectedCount} selected → apply same values
          </span>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="text"
              list="bulk-line-options"
              value={applyLine}
              onChange={(e) => setApplyLine(e.target.value)}
              placeholder="Line (leave blank to keep)"
              maxLength={50}
              className={INPUT_CLASS + " sm:max-w-[10rem]"}
            />
            <input
              type="text"
              list="bulk-manufacturer-options"
              value={applyManufacturer}
              onChange={(e) => setApplyManufacturer(e.target.value)}
              placeholder="Manufacturer (leave blank to keep)"
              maxLength={100}
              className={INPUT_CLASS + " sm:max-w-[14rem]"}
            />
            <select
              value={applyStatus}
              onChange={(e) => {
                setApplyStatus(e.target.value);
                if (e.target.value !== "on_hold") setApplyHold("");
              }}
              aria-label="Apply status"
              className={INPUT_CLASS + " sm:max-w-[10rem]"}
            >
              <option value="">Status (keep)</option>
              <option value="production">Production</option>
              <option value="on_hold">On Hold</option>
              <option value="development">Development</option>
            </select>
            {applyStatus === "on_hold" && (
              <select
                value={applyHold}
                onChange={(e) => setApplyHold(e.target.value)}
                aria-label="Apply hold location"
                className={INPUT_CLASS + " sm:max-w-[10rem]"}
              >
                <option value="">Hold location…</option>
                <option value="warehouse">Warehouse</option>
                <option value="pm">PM</option>
                <option value="n_a">N/A</option>
              </select>
            )}
            <button
              type="button"
              onClick={applyToSelected}
              disabled={!canApply}
              className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Apply to selected
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <th className="w-10 px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2 font-semibold">Fixture</th>
              <th className="px-3 py-2 font-semibold w-44">Status</th>
              <th className="px-3 py-2 font-semibold w-36">Asset tag</th>
              <th className="px-3 py-2 font-semibold w-36">Serial number</th>
              <th className="px-3 py-2 font-semibold w-28">Line</th>
              <th className="px-3 py-2 font-semibold w-44">Manufacturer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {fixtures.map((fx) => {
              const draft = draftFor(fx);
              const isChanged = changed.includes(fx);
              return (
                <tr key={fx.fixture_id} className={isChanged ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}>
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={selected.has(fx.fixture_id)}
                      onChange={() => toggle(fx.fixture_id)}
                      aria-label={`Select ${fx.fixture_name}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-gray-100">{fx.fixture_name}</td>
                  <td className="px-3 py-1.5">
                    <FixtureLifecycleFields
                      compact
                      lifecycleStatus={draft.lifecycle_status}
                      holdReason={draft.hold_reason}
                      onChange={(field, value) => setField(fx, field, value)}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={draft.asset_tag}
                      onChange={(e) => setField(fx, "asset_tag", e.target.value)}
                      placeholder="Asset tag"
                      maxLength={50}
                      className={INPUT_CLASS}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={draft.fixture_serial_number}
                      onChange={(e) => setField(fx, "fixture_serial_number", e.target.value)}
                      placeholder="Serial number"
                      maxLength={50}
                      className={INPUT_CLASS}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      list="bulk-line-options"
                      value={draft.production_line}
                      onChange={(e) => setField(fx, "production_line", e.target.value)}
                      placeholder="e.g. LINE 7"
                      maxLength={50}
                      className={INPUT_CLASS}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      list="bulk-manufacturer-options"
                      value={draft.manufacturer}
                      onChange={(e) => setField(fx, "manufacturer", e.target.value)}
                      placeholder="e.g. BOJAY ELECTRONICS CO"
                      maxLength={100}
                      className={INPUT_CLASS}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
