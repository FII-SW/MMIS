import { useCallback, useEffect, useState } from "react";
import API from "../../api";
import { apiErrorMessage } from "../../utils/apiError";
import { ROLE_LABELS } from "../../utils/auth";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, FIELD, Label, Notice } from "./ui";

const ROLE_ORDER = ["user", "admin", "superadmin", "viewer"];
const LINKS = [
  { value: "", label: "No link" },
  { value: "/dashboard/maintenance/dashboard?tab=mine", label: "My PMs" },
  { value: "/dashboard/maintenance/dashboard?tab=todo", label: "PM To do list" },
  { value: "/dashboard/documents", label: "Documents" },
  { value: "/dashboard/alerts", label: "Low Stock Alerts" },
  { value: "/dashboard/reports", label: "Reports" },
];
const EMPTY = { title: "", message: "", roles: [], email: false, link: "" };

function formatWhen(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
}

/** Super Admin: send a message to everyone's bell (or only some access levels). */
export default function AnnouncementsTab() {
  const [form, setForm] = useState(EMPTY);
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    API.get("/admin/announcements")
      .then((res) => setHistory(res.data.announcements || []))
      .catch((err) => setError(apiErrorMessage(err, "Could not load past announcements.")));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRole = (role) =>
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter((r) => r !== role) : [...prev.roles, role],
    }));

  const audience = form.roles.length
    ? ROLE_ORDER.filter((r) => form.roles.includes(r)).map((r) => ROLE_LABELS[r]).join(", ")
    : "Everyone";

  const send = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Send "${form.title}" to ${audience}${form.email ? " (also by email)" : ""}?`)) return;
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const res = await API.post("/admin/announcements", { ...form, link: form.link || null });
      setSuccess(
        `Sent to ${res.data.recipients} people (${res.data.audience})` +
          (form.email ? `, ${res.data.emailed} by email.` : ".")
      );
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not send the announcement."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Notice onClose={() => setError("")}>{error}</Notice>
      <Notice type="success" onClose={() => setSuccess("")}>
        {success}
      </Notice>

      <form onSubmit={send} className={`${CARD} space-y-4`}>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">New announcement</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Shows in everyone&apos;s 🔔 bell and as a purple banner until they click Got it. E.g. &quot;PM audit on
            Friday&quot; or &quot;New SOP uploaded&quot;.
          </p>
        </div>
        <label className="block">
          <Label>Title *</Label>
          <input
            className={FIELD}
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            maxLength={150}
            required
            placeholder="Short headline"
          />
        </label>
        <label className="block">
          <Label>Message *</Label>
          <textarea
            className={`${FIELD} min-h-[110px]`}
            value={form.message}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
            maxLength={2000}
            required
            placeholder="What people need to know or do"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">{form.message.length}/2000</span>
        </label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Send to</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, roles: [] }))}
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                  form.roles.length === 0
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                Everyone
              </button>
              {ROLE_ORDER.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                    form.roles.includes(role)
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {ROLE_LABELS[role]}s
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <Label>Button in the notification opens</Label>
            <select
              className={FIELD}
              value={form.link}
              onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
            >
              {LINKS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.checked }))}
          />
          Also send by email (to people who have an email address in MMIS)
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={BUTTON_SECONDARY} disabled={sending} onClick={() => setForm(EMPTY)}>
            Clear
          </button>
          <button type="submit" className={BUTTON_PRIMARY} disabled={sending || !form.title.trim() || !form.message.trim()}>
            {sending ? "Sending…" : `Send to ${audience}`}
          </button>
        </div>
      </form>

      <div className={CARD}>
        <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100">Sent announcements</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nothing sent yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {history.map((a, i) => (
              <li key={`${a.created_at}-${i}`} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{a.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatWhen(a.created_at)} · {a.sender || "Unknown"}
                  </p>
                </div>
                <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{a.message}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  To {a.roles?.length ? a.roles.map((r) => ROLE_LABELS[r] || r).join(", ") : "Everyone"} ·{" "}
                  {a.recipients} people{a.email ? " · also emailed" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
