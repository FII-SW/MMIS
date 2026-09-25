import { useMemo, useState } from "react";
import API from "../../api";
import { useFixtureDescriptorOptions } from "../FixtureDescriptorFields";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white";

function clean(value) {
  return (value || "").trim();
}

export default function BulkDescriptorEditor({ fixtures, onClose, onSaved }) {
  const options = useFixtureDescriptorOptions();
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      fixtures.map((fx) => [
        fx.fixture_id,
        { manufacturer: fx.manufacturer || "", production_line: fx.production_line || "" },
      ])
    )
  );
  const [selected, setSelected] = useState(() => new Set());
  const [applyManufacturer, setApplyManufacturer] = useState("");
  const [applyLine, setApplyLine] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const draftFor = (fx) =>
    drafts[fx.fixture_id] || {
      manufacturer: fx.manufacturer || "",
      production_line: fx.production_line || "",
    };

  const changed = useMemo(
    () =>
      fixtures.filter((fx) => {
        const draft = drafts[fx.fixture_id];
        if (!draft) return false;
        return (
          clean(draft.manufacturer) !== clean(fx.manufacturer) ||
          clean(draft.production_line) !== clean(fx.production_line)
        );
      }),
    [fixtures, drafts]
  );

  const selectedCount = fixtures.filter((fx) => selected.has(fx.fixture_id)).length;
  const allSelected = fixtures.length > 0 && selectedCount === fixtures.length;

  const setField = (fx, field, value) =>
    setDrafts((prev) => ({
      ...prev,
      [fx.fixture_id]: { ...(prev[fx.fixture_id] || draftFor(fx)), [field]: value },
    }));

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
          next[fx.fixture_id] = {
            manufacturer: applyManufacturer.trim() ? applyManufacturer : current.manufacturer,
            production_line: applyLine.trim() ? applyLine : current.production_line,
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
    setSaving(true);
    setError("");
    const updates = changed.map((fx) => ({
      fixture_id: fx.fixture_id,
      manufacturer: clean(drafts[fx.fixture_id].manufacturer) || null,
      production_line: clean(drafts[fx.fixture_id].production_line) || null,
    }));
    try {
      await API.patch("/fixtures/bulk-descriptors", { updates });
      onSaved(updates);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

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
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Edit production info</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Type each fixture&apos;s own line and manufacturer, or select several and apply a value to all of them.
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
              {saving ? "Saving…" : `Save ${changed.length} change${changed.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-900/40 sm:flex-row sm:items-center">
          <span className="shrink-0 text-xs font-semibold text-gray-600 dark:text-gray-300">
            {selectedCount} selected →
          </span>
          <input
            type="text"
            list="bulk-line-options"
            value={applyLine}
            onChange={(e) => setApplyLine(e.target.value)}
            placeholder="Line (leave blank to keep)"
            maxLength={50}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            list="bulk-manufacturer-options"
            value={applyManufacturer}
            onChange={(e) => setApplyManufacturer(e.target.value)}
            placeholder="Manufacturer (leave blank to keep)"
            maxLength={100}
            className={INPUT_CLASS}
          />
          <button
            type="button"
            onClick={applyToSelected}
            disabled={selectedCount === 0 || (!applyLine.trim() && !applyManufacturer.trim())}
            className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Apply to selected
          </button>
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
              <th className="px-3 py-2 font-semibold">Asset / Serial</th>
              <th className="px-3 py-2 font-semibold w-40">Line</th>
              <th className="px-3 py-2 font-semibold w-64">Manufacturer</th>
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
                  <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                    {fx.asset_tag || "—"} · {fx.fixture_serial_number || "—"}
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
