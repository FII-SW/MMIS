import { useState } from "react";
import API from "../../api";
import { isAdminUser } from "../../utils/auth";
import FixtureDescriptorFields from "../FixtureDescriptorFields";

function Field({ label, value, highlight = false }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`break-words rounded-md border px-3 py-2 text-sm ${
          highlight
            ? "border-blue-200 bg-blue-50 font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
            : "border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        }`}
      >
        {value || <span className="font-normal text-gray-400 dark:text-gray-500">(none)</span>}
      </p>
    </div>
  );
}

export default function FixtureDetailsPanel({ fixture, onUpdated }) {
  const isAdmin = isAdminUser();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ manufacturer: "", production_line: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => {
    setDraft({
      manufacturer: fixture.manufacturer || "",
      production_line: fixture.production_line || "",
    });
    setError("");
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await API.patch(`/fixtures/${fixture.fixture_id}/descriptors`, {
        manufacturer: draft.manufacturer.trim() || null,
        production_line: draft.production_line.trim() || null,
      });
      onUpdated?.(res.data);
      setEditing(false);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Production</p>
          {isAdmin && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/10">
            <FixtureDescriptorFields
              layout="grid"
              manufacturer={draft.manufacturer}
              productionLine={draft.production_line}
              onChange={(name, value) => setDraft((prev) => ({ ...prev, [name]: value }))}
              labelClassName="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              inputClassName="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Production Line" value={fixture.production_line} highlight />
            <Field label="Manufacturer" value={fixture.manufacturer} highlight />
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Asset Descriptors</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
