import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../../api";
import { apiErrorMessage } from "../../utils/apiError";
import { PersonPicker } from "./AssignmentsTab";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_SMALL, CARD, FIELD, Label, Notice, RoleBadge } from "./ui";

function Tile({ label, value, sub, tone = "text-gray-900 dark:text-gray-100" }) {
  return (
    <div className={CARD}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  );
}

function onTrackTone(value) {
  if (value === null || value === undefined) return "text-gray-400";
  if (value >= 90) return "text-green-700 dark:text-green-400";
  if (value >= 70) return "text-yellow-700 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function MovePanel({ person, people, onMoved, onCancel }) {
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const candidates = people.filter((p) => p.employee_id !== person.employee_id && p.role !== "viewer");
  const targetPerson = candidates.find((p) => String(p.employee_id) === target);

  const move = async (toId) => {
    const what = toId ? `to ${targetPerson.employee_name}` : "back to unassigned";
    if (!window.confirm(`Move all ${person.fixtures} fixture(s) from ${person.employee_name} ${what}?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await API.post("/maintenance/fixtures/pm-assignment/move", {
        from_employee_id: person.employee_id,
        to_employee_id: toId,
      });
      onMoved(
        toId
          ? `Moved ${res.data.updated} fixture(s) from ${person.employee_name} to ${res.data.employee_name}. Both were notified.`
          : `Unassigned ${res.data.updated} fixture(s) from ${person.employee_name}. They were notified.`
      );
    } catch (err) {
      setError(apiErrorMessage(err, "Could not move the fixtures."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        Move all {person.fixtures} fixture{person.fixtures === 1 ? "" : "s"} from {person.employee_name}
        <span className="font-normal text-gray-600 dark:text-gray-300"> — e.g. they left, went on leave or changed shift</span>
      </p>
      <div className="max-w-md">
        <Label>Move to</Label>
        <PersonPicker users={candidates} value={target} onChange={setTarget} />
        {targetPerson && (
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            {targetPerson.employee_name} has {targetPerson.fixtures} fixture{targetPerson.fixtures === 1 ? "" : "s"} now
            {targetPerson.overdue ? `, ${targetPerson.overdue} overdue` : ""}. After the move: {targetPerson.fixtures + person.fixtures}.
          </p>
        )}
      </div>
      <Notice>{error}</Notice>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON_PRIMARY} disabled={!targetPerson || saving} onClick={() => move(targetPerson.employee_id)}>
          {saving ? "Moving…" : targetPerson ? `Move to ${targetPerson.employee_username}` : "Pick a person"}
        </button>
        <button type="button" className={BUTTON_SECONDARY} disabled={saving} onClick={() => move(null)}>
          Unassign all instead
        </button>
        <button type="button" className={BUTTON_SECONDARY} disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Super Admin: who owns how many PM fixtures, how they're doing, and fixtures nobody owns. */
export default function WorkloadTab() {
  const [, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [onlyAssigned, setOnlyAssigned] = useState(true);
  const [moving, setMoving] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await API.get("/maintenance/pm-workload");
      setData(res.data);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load the workload."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const people = useMemo(() => data?.people || [], [data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      if (onlyAssigned && !p.fixtures) return false;
      if (!q) return true;
      return [p.employee_name, p.employee_username, p.employee_designation, p.employee_shift, ...p.areas]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [people, search, onlyAssigned]);

  if (loading) return <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading workload…</p>;

  const owners = people.filter((p) => p.fixtures);
  const behind = owners.filter((p) => p.overdue);
  const unassigned = data?.unassigned || { fixtures: 0, areas: [] };
  const assignedCount = owners.reduce((sum, p) => sum + p.fixtures, 0);

  return (
    <div className="space-y-4">
      <Notice onClose={() => setError("")}>{error}</Notice>
      <Notice type="success" onClose={() => setSuccess("")}>
        {success}
      </Notice>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="People with PM fixtures" value={owners.length} sub={`${assignedCount} fixtures assigned`} />
        <Tile
          label="Falling behind"
          value={behind.length}
          sub="People with at least one overdue PM"
          tone={behind.length ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}
        />
        <Tile
          label="Nobody responsible"
          value={unassigned.fixtures}
          sub={unassigned.overdue ? `${unassigned.overdue} of them overdue` : "PM fixtures without an assignee"}
          tone={unassigned.fixtures ? "text-orange-600 dark:text-orange-400" : "text-green-700 dark:text-green-400"}
        />
        <Tile label="PM fixtures in total" value={data?.total_fixtures ?? 0} />
      </div>

      {unassigned.fixtures > 0 && (
        <div className={CARD}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-gray-800 dark:text-gray-100">Fixtures nobody is responsible for</p>
            <button type="button" className={BUTTON_SMALL} onClick={() => setSearchParams({ tab: "assignments" }, { replace: true })}>
              Assign them →
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.areas.map((a) => (
              <span
                key={a.area}
                className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-900/30 dark:text-orange-200"
              >
                {a.area}: {a.fixtures}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={CARD}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <Label>Search</Label>
            <input
              className={FIELD}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, username, designation, shift or test area"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={onlyAssigned} onChange={(e) => setOnlyAssigned(e.target.checked)} />
            Only people with fixtures
          </label>
          <button type="button" className={`${BUTTON_SECONDARY} ml-auto`} onClick={load}>
            ↻ Refresh
          </button>
        </div>

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {owners.length ? "Nobody matches this search." : "No fixtures are assigned yet. Use the PM Assignments tab."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="py-2 pr-3 font-semibold">Person</th>
                  <th className="py-2 pr-3 text-right font-semibold">Fixtures</th>
                  <th className="py-2 pr-3 text-right font-semibold">Overdue</th>
                  <th className="py-2 pr-3 text-right font-semibold">Due soon</th>
                  <th className="py-2 pr-3 text-right font-semibold">Up to date</th>
                  <th className="py-2 pr-3 text-right font-semibold">On track</th>
                  <th className="py-2 pr-3 font-semibold">Areas</th>
                  <th className="py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {visible.map((p) => (
                  <Fragment key={p.employee_id}>
                    <tr className="align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{p.employee_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {[p.employee_username, p.employee_designation, p.employee_shift].filter(Boolean).join(" · ")}
                        </div>
                        <RoleBadge role={p.role} label={p.role_label} />
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-gray-800 dark:text-gray-100">{p.fixtures || "—"}</td>
                      <td className={`py-2 pr-3 text-right ${p.overdue ? "font-bold text-red-600 dark:text-red-400" : "text-gray-500"}`}>
                        {p.overdue || "—"}
                        {p.worst_days_overdue > 0 && (
                          <div className="text-[11px] font-normal">up to {p.worst_days_overdue}d</div>
                        )}
                      </td>
                      <td className={`py-2 pr-3 text-right ${p.due_soon ? "font-semibold text-yellow-700 dark:text-yellow-400" : "text-gray-500"}`}>
                        {p.due_soon || "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-green-700 dark:text-green-400">{p.ok || "—"}</td>
                      <td className={`py-2 pr-3 text-right font-semibold ${onTrackTone(p.on_track)}`}>
                        {p.on_track === null || p.on_track === undefined ? "—" : `${p.on_track}%`}
                      </td>
                      <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">
                        {p.areas.slice(0, 3).join(", ")}
                        {p.areas.length > 3 && ` +${p.areas.length - 3} more`}
                      </td>
                      <td className="py-2 text-right">
                        {p.fixtures > 0 && (
                          <button
                            type="button"
                            className={BUTTON_SMALL}
                            onClick={() => setMoving(moving === p.employee_id ? null : p.employee_id)}
                          >
                            Move fixtures
                          </button>
                        )}
                      </td>
                    </tr>
                    {moving === p.employee_id && (
                      <tr>
                        <td colSpan={8} className="pb-3">
                          <MovePanel
                            person={p}
                            people={people}
                            onCancel={() => setMoving(null)}
                            onMoved={(message) => {
                              setMoving(null);
                              setSuccess(message);
                              load();
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
