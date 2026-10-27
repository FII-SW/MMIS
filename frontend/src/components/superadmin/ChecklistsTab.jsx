import { useCallback, useEffect, useState } from "react";
import API from "../../api";
import { apiErrorMessage } from "../../utils/apiError";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_SMALL, CARD, FIELD, Label, Notice } from "./ui";

const emptyTask = () => ({ id: "", task: "" });
const emptySection = () => ({ name: "", items: [emptyTask()] });

function cloneChecklist(checklist) {
  return {
    title: checklist.title || "",
    description: checklist.description || "",
    summary: checklist.summary || "",
    reference: checklist.reference || "",
    note: checklist.note || "",
    sections: (checklist.sections || []).map((section) => ({
      name: section.name || "",
      items: (section.items || []).map((item) => ({ id: item.id || "", task: item.task || "" })),
    })),
  };
}

export default function ChecklistsTab() {
  const [checklists, setChecklists] = useState([]);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await API.get("/admin/pm-checklists");
      const rows = res.data.checklists || [];
      setChecklists(rows);
      setSelected((current) => current || (rows[0] ? `${rows[0].family}:${rows[0].pm_type}` : ""));
      setError("");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        setError(
          "Checklist API not found on the server. Pull the latest code, restart mmis-backend, then refresh this page (Ctrl+F5)."
        );
      } else {
        setError(apiErrorMessage(err, "Could not load the checklists."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = checklists.find((row) => `${row.family}:${row.pm_type}` === selected) || null;

  useEffect(() => {
    setDraft(current ? cloneChecklist(current) : null);
  }, [current]);

  const updateSection = (index, patch) =>
    setDraft((prev) => ({
      ...prev,
      sections: prev.sections.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    }));

  const move = (list, index, direction) => {
    const next = [...list];
    const target = index + direction;
    if (target < 0 || target >= next.length) return list;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  const save = async () => {
    if (!current || !draft) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await API.put(`/admin/pm-checklists/${current.family}/${current.pm_type}`, {
        ...draft,
        reference: draft.reference || null,
      });
      setChecklists((prev) => prev.map((row) => (row.family === res.data.family && row.pm_type === res.data.pm_type ? res.data : row)));
      setSuccess("Checklist saved. The next PM recorded uses this list. Past PMs keep the tasks they were recorded with.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the checklist."));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!current?.customized) return;
    if (!window.confirm(`Reset the ${current.family} ${current.label} checklist to the built-in list?`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await API.delete(`/admin/pm-checklists/${current.family}/${current.pm_type}`);
      setChecklists((prev) => prev.map((row) => (row.family === res.data.family && row.pm_type === res.data.pm_type ? res.data : row)));
      setSuccess("Restored the built-in checklist.");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not reset the checklist."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading checklists…</p>;
  if (!draft || !current) return <Notice>{error || "No checklists are configured."}</Notice>;

  return (
    <div className="space-y-4">
      <Notice onClose={() => setError("")}>{error}</Notice>
      <Notice type="success" onClose={() => setSuccess("")}>
        {success}
      </Notice>

      <div className="flex flex-wrap gap-2">
        {checklists.map((row) => {
          const id = `${row.family}:${row.pm_type}`;
          const active = id === selected;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {row.family} {row.label}
              {row.customized ? " · edited" : ""}
            </button>
          );
        })}
      </div>

      <div className={`${CARD} space-y-4`}>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {current.family} {current.label}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {current.task_count} tasks. Changes apply to the next PM someone records.
            {current.requires_details && " This checklist also asks for maintenance type, activation counter, commodity replacement and downtime."}
          </p>
        </div>
        <label className="block">
          <Label>Title</Label>
          <input className={FIELD} value={draft.title} maxLength={200} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} />
        </label>
        <label className="block">
          <Label>Summary shown above the tasks</Label>
          <textarea className={`${FIELD} min-h-[70px]`} value={draft.summary} maxLength={1000} onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))} />
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <Label>Description</Label>
            <input className={FIELD} value={draft.description} maxLength={300} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} />
          </label>
          <label className="block">
            <Label>Reference (optional)</Label>
            <input className={FIELD} value={draft.reference} maxLength={300} onChange={(e) => setDraft((prev) => ({ ...prev, reference: e.target.value }))} />
          </label>
        </div>
        <label className="block">
          <Label>Note under the tasks</Label>
          <textarea className={`${FIELD} min-h-[70px]`} value={draft.note} maxLength={2000} onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))} />
        </label>

        {draft.sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40">
              <input
                className={`${FIELD} min-w-[12rem] flex-1`}
                value={section.name}
                maxLength={80}
                placeholder="Section name"
                onChange={(e) => updateSection(sectionIndex, { name: e.target.value })}
              />
              <button type="button" className={BUTTON_SMALL} onClick={() => setDraft((prev) => ({ ...prev, sections: move(prev.sections, sectionIndex, -1) }))}>
                Up
              </button>
              <button type="button" className={BUTTON_SMALL} onClick={() => setDraft((prev) => ({ ...prev, sections: move(prev.sections, sectionIndex, 1) }))}>
                Down
              </button>
              <button
                type="button"
                className={BUTTON_SMALL}
                disabled={draft.sections.length === 1}
                onClick={() =>
                  setDraft((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== sectionIndex) }))
                }
              >
                Remove section
              </button>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {section.items.map((item, itemIndex) => (
                <li key={item.id || `new-${sectionIndex}-${itemIndex}`} className="flex items-start gap-2 p-2">
                  <textarea
                    className={`${FIELD} min-h-[42px] flex-1`}
                    value={item.task}
                    maxLength={500}
                    placeholder="Task"
                    onChange={(e) =>
                      updateSection(sectionIndex, {
                        items: section.items.map((row, i) => (i === itemIndex ? { ...row, task: e.target.value } : row)),
                      })
                    }
                  />
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      className={BUTTON_SMALL}
                      onClick={() => updateSection(sectionIndex, { items: move(section.items, itemIndex, -1) })}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className={BUTTON_SMALL}
                      onClick={() => updateSection(sectionIndex, { items: move(section.items, itemIndex, 1) })}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className={BUTTON_SMALL}
                      disabled={section.items.length === 1}
                      onClick={() =>
                        updateSection(sectionIndex, { items: section.items.filter((_, i) => i !== itemIndex) })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="p-2">
              <button
                type="button"
                className={BUTTON_SMALL}
                onClick={() => updateSection(sectionIndex, { items: [...section.items, emptyTask()] })}
              >
                + Add task
              </button>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" className={BUTTON_SECONDARY} onClick={() => setDraft((prev) => ({ ...prev, sections: [...prev.sections, emptySection()] }))}>
            + Add section
          </button>
          <div className="flex gap-2">
            <button type="button" className={BUTTON_SECONDARY} disabled={saving || !current.customized} onClick={reset}>
              Reset to built-in
            </button>
            <button type="button" className={BUTTON_PRIMARY} disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save checklist"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
