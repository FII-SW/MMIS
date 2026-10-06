import { useEffect, useState } from "react";
import API from "../../api";
import { apiErrorMessage } from "../../utils/apiError";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, FIELD, Label, Notice } from "./ui";

const valuesOf = (settings) => Object.fromEntries(settings.map((s) => [s.key, s.value ?? ""]));

const RUN_NOW = {
  pm_weekly_reminders: {
    job: "weekly_reminder",
    label: "Send reminders now",
    confirm: "Send the weekly PM reminder to everyone with assigned fixtures right now?",
    done: (n) => `Weekly reminder sent to ${n} people.`,
  },
  pm_overdue_alerts: {
    job: "overdue_alerts",
    label: "Check for overdue PMs now",
    confirm: "Check assigned fixtures for overdue PMs and alert admins now?\n\nFixtures already reported are skipped.",
    done: (n) => (n ? `Sent ${n} overdue alert(s).` : "No new overdue fixtures to report."),
  },
};

export default function SettingsTab() {
  const [settings, setSettings] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [running, setRunning] = useState("");

  useEffect(() => {
    API.get("/admin/settings")
      .then((res) => {
        setSettings(res.data.settings || []);
        setValues(valuesOf(res.data.settings || []));
      })
      .catch((err) => setError(apiErrorMessage(err, "Could not load settings.")))
      .finally(() => setLoading(false));
  }, []);

  const saved = valuesOf(settings);
  const dirty = settings.some((s) => String(values[s.key] ?? "") !== String(saved[s.key] ?? ""));

  const save = async (e) => {
    e.preventDefault();
    if (
      values.pm_start_date !== saved.pm_start_date &&
      !window.confirm(
        "Change the PM tracking start date?\n\nOverdue counts on the PM Dashboard, To-do list and PM Report will be recalculated from the new date."
      )
    )
      return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await API.put("/admin/settings", { values });
      setSettings(res.data.settings || []);
      setValues(valuesOf(res.data.settings || []));
      setSuccess(res.data.changed?.length ? "Settings saved." : "Nothing changed.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save settings."));
    } finally {
      setSaving(false);
    }
  };

  const runNow = async (key) => {
    const action = RUN_NOW[key];
    if (!window.confirm(action.confirm)) return;
    setRunning(key);
    setError("");
    setSuccess("");
    try {
      const res = await API.post(`/admin/jobs/${action.job}/run`);
      setSuccess(action.done(res.data.count));
    } catch (err) {
      setError(apiErrorMessage(err, "Could not run it."));
    } finally {
      setRunning("");
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading settings…</p>;
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Notice onClose={() => setError("")}>{error}</Notice>
      <Notice type="success" onClose={() => setSuccess("")}>
        {success}
      </Notice>

      {settings.map((setting) => (
        <div key={setting.key} className={CARD}>
          {setting.type === "bool" ? (
            <div className="flex flex-wrap items-start gap-3">
              <label className="flex flex-1 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={values[setting.key] === "true"}
                  onChange={(e) => setValues((prev) => ({ ...prev, [setting.key]: e.target.checked ? "true" : "false" }))}
                />
                <span>
                  <span className="block font-semibold text-gray-800 dark:text-gray-100">{setting.label}</span>
                  <span className="block text-sm text-gray-600 dark:text-gray-300">{setting.help}</span>
                </span>
              </label>
              {RUN_NOW[setting.key] && saved[setting.key] === "true" && (
                <button
                  type="button"
                  className={`${BUTTON_SECONDARY} shrink-0`}
                  disabled={Boolean(running)}
                  onClick={() => runNow(setting.key)}
                >
                  {running === setting.key ? "Running…" : RUN_NOW[setting.key].label}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-semibold text-gray-800 dark:text-gray-100">{setting.label}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{setting.help}</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="w-56">
                  <Label>{setting.type === "date" ? "Date" : setting.type === "int" ? "Days" : "Value"}</Label>
                  <input
                    type={setting.type === "date" ? "date" : setting.type === "int" ? "number" : "text"}
                    min={setting.min}
                    max={setting.max}
                    className={FIELD}
                    value={values[setting.key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                  />
                </label>
                {values[setting.key] && setting.type !== "int" && (
                  <button
                    type="button"
                    className={BUTTON_SECONDARY}
                    onClick={() => setValues((prev) => ({ ...prev, [setting.key]: "" }))}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON_SECONDARY} disabled={!dirty || saving} onClick={() => setValues(saved)}>
          Undo changes
        </button>
        <button type="submit" className={BUTTON_PRIMARY} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
