import { useEffect, useMemo, useState } from "react";
import API from "../../api";
import { apiErrorMessage } from "../../utils/apiError";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_SMALL, CARD, FIELD, Label, Notice, RoleBadge } from "./ui";

const ROWS_PER_PAGE = 50;

const naturalCompare = (a, b) =>
  (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: "base" });

function StepTitle({ number, children, hint }) {
  return (
    <div className="mb-3">
      <h3 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {number}
        </span>
        {children}
      </h3>
      {hint && <p className="ml-8 mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <>
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-800 dark:text-gray-100">{children || "—"}</dd>
    </>
  );
}

const personLabel = (user) =>
  [user.employee_username, user.employee_designation, user.role_label].filter(Boolean).join(" · ");

export function PersonPicker({ users, value, onChange }) {
  const selectedUser = users.find((user) => String(user.employee_id) === value) || null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? users.filter((user) =>
          [user.employee_username, user.employee_designation, user.role_label]
            .filter(Boolean)
            .some((text) => text.toLowerCase().includes(q))
        )
      : users;
    return [...list].sort((a, b) => naturalCompare(a.employee_username, b.employee_username));
  }, [users, query]);

  const pick = (user) => {
    onChange(String(user.employee_id));
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open && matches[highlight]) {
      e.preventDefault();
      pick(matches[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          className={FIELD}
          value={open ? query : selectedUser ? personLabel(selectedUser) : ""}
          placeholder="Type a username to search…"
          onFocus={() => {
            setOpen(true);
            setHighlight(0);
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label="Person"
        />
        {selectedUser && (
          <button type="button" className={BUTTON_SECONDARY} onClick={() => onChange("")}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No username matches “{query}”</li>
          ) : (
            matches.map((user, index) => (
              <li
                key={user.employee_id}
                role="option"
                aria-selected={String(user.employee_id) === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(user);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                  index === highlight ? "bg-blue-50 dark:bg-blue-900/30" : ""
                }`}
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{user.employee_username}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {" · "}
                    {user.employee_designation || "No designation"}
                  </span>
                </span>
                <RoleBadge role={user.role} label={user.role_label} />
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function UserInfoCard({ user, fixtures }) {
  const groups = useMemo(() => {
    const counts = {};
    fixtures
      .filter((f) => f.pm_assigned_employee_id === user.employee_id)
      .forEach((f) => {
        const key = `${f.project_name || "No project"} · ${f.test_area || "No test area"}`;
        counts[key] = (counts[key] || 0) + 1;
      });
    return Object.entries(counts).sort(([a], [b]) => naturalCompare(a, b));
  }, [user, fixtures]);
  const total = groups.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800 dark:bg-blue-900/20">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{user.employee_name}</p>
        <RoleBadge role={user.role} label={user.role_label} />
      </div>
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto,1fr,auto,1fr]">
        <InfoRow label="Badge">{user.employee_badge_number}</InfoRow>
        <InfoRow label="Username">{user.employee_username}</InfoRow>
        <InfoRow label="Designation">{user.employee_designation}</InfoRow>
        <InfoRow label="Shift">{user.employee_shift}</InfoRow>
        <InfoRow label="Email">{user.employee_email}</InfoRow>
        <InfoRow label="PM fixtures now">{String(total)}</InfoRow>
      </dl>
      {groups.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Already assigned
          </p>
          <div className="flex flex-wrap gap-1.5">
            {groups.map(([key, count]) => (
              <span
                key={key}
                className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200"
              >
                {key}: <b>{count}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssignmentsTab() {
  const [fixtures, setFixtures] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [project, setProject] = useState("");
  const [testArea, setTestArea] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [lastClicked, setLastClicked] = useState(null);
  const [assignTo, setAssignTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      const [overview, userRes] = await Promise.all([
        API.get("/maintenance/overview", { params: { pm_only: true } }),
        API.get("/admin/users"),
      ]);
      setFixtures(
        [...(overview.data.fixtures || [])].sort((a, b) => naturalCompare(a.fixture_name, b.fixture_name))
      );
      setUsers((userRes.data.users || []).filter((user) => user.active && user.role !== "viewer"));
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load fixtures."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const projects = useMemo(
    () => [...new Set(fixtures.map((f) => f.project_name).filter(Boolean))].sort(naturalCompare),
    [fixtures]
  );
  const testAreas = useMemo(
    () =>
      [
        ...new Set(
          fixtures.filter((f) => !project || f.project_name === project).map((f) => f.test_area).filter(Boolean)
        ),
      ].sort(naturalCompare),
    [fixtures, project]
  );

  // Fixtures in the chosen project / test area, in name order. Ranges are picked from this list.
  const scope = useMemo(
    () =>
      fixtures.filter(
        (f) => (!project || f.project_name === project) && (!testArea || f.test_area === testArea)
      ),
    [fixtures, project, testArea]
  );
  const positions = useMemo(() => new Map(scope.map((f, index) => [f.fixture_id, index + 1])), [scope]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scope.filter((f) => {
      if (assigneeFilter === "unassigned" && f.pm_assigned_employee_id) return false;
      if (assigneeFilter === "assigned" && !f.pm_assigned_employee_id) return false;
      if (!["all", "unassigned", "assigned"].includes(assigneeFilter) && String(f.pm_assigned_employee_id) !== assigneeFilter)
        return false;
      if (!q) return true;
      return [f.fixture_name, f.asset_tag, f.fixture_serial_number, f.production_line, f.pm_assigned_to]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [scope, assigneeFilter, search]);

  const pageCount = Math.max(1, Math.ceil(visible.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  const allVisibleSelected = visible.length > 0 && visible.every((f) => selected.has(f.fixture_id));

  const rangeIds = useMemo(() => {
    if (!rangeFrom || !rangeTo) return [];
    const a = scope.findIndex((f) => String(f.fixture_id) === rangeFrom);
    const b = scope.findIndex((f) => String(f.fixture_id) === rangeTo);
    if (a < 0 || b < 0) return [];
    return scope.slice(Math.min(a, b), Math.max(a, b) + 1).map((f) => f.fixture_id);
  }, [scope, rangeFrom, rangeTo]);

  const selectedFixtures = useMemo(() => fixtures.filter((f) => selected.has(f.fixture_id)), [fixtures, selected]);
  const assignee = users.find((user) => String(user.employee_id) === assignTo) || null;
  const movingFromOthers = assignee
    ? selectedFixtures.filter((f) => f.pm_assigned_employee_id && f.pm_assigned_employee_id !== assignee.employee_id)
    : [];
  const alreadyTheirs = assignee
    ? selectedFixtures.filter((f) => f.pm_assigned_employee_id === assignee.employee_id).length
    : 0;

  const changeScope = (nextProject, nextTestArea) => {
    setProject(nextProject);
    setTestArea(nextTestArea);
    setRangeFrom("");
    setRangeTo("");
    setLastClicked(null);
    setPage(1);
  };

  const applyRange = (add) => {
    setSelected((prev) => {
      const next = add ? new Set(prev) : new Set();
      rangeIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAllInScope = () => setSelected(new Set(scope.map((f) => f.fixture_id)));

  const toggleRow = (fixture, shiftKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClicked !== null) {
        const a = visible.findIndex((f) => f.fixture_id === lastClicked);
        const b = visible.findIndex((f) => f.fixture_id === fixture.fixture_id);
        if (a >= 0 && b >= 0) {
          visible.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((f) => next.add(f.fixture_id));
          return next;
        }
      }
      if (next.has(fixture.fixture_id)) next.delete(fixture.fixture_id);
      else next.add(fixture.fixture_id);
      return next;
    });
    setLastClicked(fixture.fixture_id);
  };

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((f) => (allVisibleSelected ? next.delete(f.fixture_id) : next.add(f.fixture_id)));
      return next;
    });

  const save = async (employeeId) => {
    if (employeeId === null && !window.confirm(`Remove the PM assignee from ${selected.size} fixture(s)?`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await API.put("/maintenance/fixtures/pm-assignment", {
        fixture_ids: [...selected],
        employee_id: employeeId,
      });
      const { updated, employee_name: name, notified, emailed } = res.data;
      const told = notified
        ? ` ${name} has been notified in MMIS${emailed ? " and by email" : ""} and will see them under Maintenance → My PMs.`
        : "";
      setSuccess(
        updated === 0
          ? "Nothing changed. Those fixtures already had that assignment."
          : name
            ? `Assigned ${updated} fixture(s) to ${name}.${told}`
            : `Removed the assignee from ${updated} fixture(s). Anyone who had them was notified.`
      );
      setSelected(new Set());
      setLastClicked(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the assignment."));
    } finally {
      setSaving(false);
    }
  };

  const fixtureOption = (f) => (
    <option key={f.fixture_id} value={String(f.fixture_id)}>
      {positions.get(f.fixture_id)}. {f.fixture_name}
      {f.pm_assigned_to ? ` (${f.pm_assigned_to})` : ""}
    </option>
  );

  const selectionLabel = (() => {
    if (!selectedFixtures.length) return "No fixtures selected";
    if (selectedFixtures.length === 1) return selectedFixtures[0].fixture_name;
    return `${selectedFixtures.length} fixtures: ${selectedFixtures[0].fixture_name} … ${
      selectedFixtures[selectedFixtures.length - 1].fixture_name
    }`;
  })();

  if (loading) {
    return <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading fixtures and users…</p>;
  }

  return (
    <div className="space-y-4">
      <Notice onClose={() => setError("")}>{error}</Notice>
      <Notice type="success" onClose={() => setSuccess("")}>
        {success}
      </Notice>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={CARD}>
          <StepTitle number={1} hint="Only fixtures that have PM checklists (FBT, ICT…) are listed.">
            Choose project and test area
          </StepTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <Label>Project</Label>
              <select className={FIELD} value={project} onChange={(e) => changeScope(e.target.value, "")}>
                <option value="">All projects</option>
                {projects.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <Label>Test area</Label>
              <select className={FIELD} value={testArea} onChange={(e) => changeScope(project, e.target.value)}>
                <option value="">All test areas</option>
                {testAreas.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {scope.length} fixture{scope.length === 1 ? "" : "s"} ·{" "}
            {scope.filter((f) => !f.pm_assigned_employee_id).length} not assigned yet
          </p>

          <div className="mt-5">
            <StepTitle number={2} hint="Pick the first and last fixture. Everything in between (in name order) is selected.">
              Choose a range of fixtures
            </StepTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <Label>From fixture</Label>
                <select
                  className={FIELD}
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  disabled={!scope.length}
                >
                  <option value="">First fixture…</option>
                  {scope.map(fixtureOption)}
                </select>
              </label>
              <label>
                <Label>To fixture</Label>
                <select
                  className={FIELD}
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  disabled={!scope.length}
                >
                  <option value="">Last fixture…</option>
                  {scope.map(fixtureOption)}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className={BUTTON_PRIMARY} disabled={!rangeIds.length} onClick={() => applyRange(false)}>
                Select {rangeIds.length || ""} fixture{rangeIds.length === 1 ? "" : "s"}
              </button>
              <button
                type="button"
                className={BUTTON_SECONDARY}
                disabled={!rangeIds.length}
                onClick={() => applyRange(true)}
                title="Keep what is already selected and add this range"
              >
                + Add to selection
              </button>
              <button type="button" className={BUTTON_SECONDARY} disabled={!scope.length} onClick={selectAllInScope}>
                Select all {scope.length}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              You can also tick fixtures in the table below. Hold Shift and click to tick everything between two rows.
            </p>
          </div>
        </div>

        <div className={CARD}>
          <StepTitle number={3} hint="Active Users, Admins and Super Admins. Viewers can't record PMs.">
            Choose who does the PM
          </StepTitle>
          <div>
            <Label>Person (username · designation · access level)</Label>
            <PersonPicker users={users} value={assignTo} onChange={setAssignTo} />
          </div>
          {assignee ? (
            <UserInfoCard user={assignee} fixtures={fixtures} />
          ) : (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Their badge, designation, shift, email and current PM fixtures will show here.
            </p>
          )}
        </div>
      </div>

      <div className={`${CARD} sticky top-0 z-10`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100" title={selectionLabel}>
              {selectionLabel}
            </p>
            {assignee && selected.size > 0 && (
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Will assign to <b>{assignee.employee_username}</b> ({assignee.employee_name})
                {movingFromOthers.length > 0 && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {" "}
                    · {movingFromOthers.length} currently assigned to someone else will move
                  </span>
                )}
                {alreadyTheirs > 0 && <span> · {alreadyTheirs} already theirs</span>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 && (
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </button>
            )}
            <button type="button" className={BUTTON_SECONDARY} disabled={saving || !selected.size} onClick={() => save(null)}>
              Unassign
            </button>
            <button
              type="button"
              className={BUTTON_PRIMARY}
              disabled={saving || !selected.size || !assignee}
              onClick={() => save(assignee.employee_id)}
            >
              {saving ? "Saving…" : assignee ? `Assign ${selected.size || ""} to ${assignee.employee_username}` : "Assign"}
            </button>
          </div>
        </div>
      </div>

      <div className={CARD}>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="w-56">
            <Label>Show</Label>
            <select
              className={FIELD}
              value={assigneeFilter}
              onChange={(e) => {
                setAssigneeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All fixtures</option>
              <option value="unassigned">Not assigned</option>
              <option value="assigned">Assigned to someone</option>
              {users.map((user) => (
                <option key={user.employee_id} value={String(user.employee_id)}>
                  Assigned to {user.employee_username}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[220px] flex-1">
            <Label>Search</Label>
            <input
              className={FIELD}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Fixture, asset tag, serial, line, assignee"
            />
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No PM fixtures match these filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="w-10 py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label={`Select all ${visible.length} fixtures shown`}
                        title={`Select all ${visible.length} fixtures shown`}
                      />
                    </th>
                    <th className="w-12 py-2 pr-3 font-semibold">#</th>
                    <th className="py-2 pr-3 font-semibold">Fixture</th>
                    <th className="py-2 pr-3 font-semibold">Project</th>
                    <th className="py-2 pr-3 font-semibold">Test area</th>
                    <th className="py-2 pr-3 font-semibold">Line</th>
                    <th className="py-2 font-semibold">Assigned to</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {pageRows.map((f) => (
                    <tr
                      key={f.fixture_id}
                      onClick={(e) => toggleRow(f, e.shiftKey)}
                      className={`cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                        selected.has(f.fixture_id) ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={selected.has(f.fixture_id)}
                          readOnly
                          tabIndex={-1}
                          aria-label={`Select ${f.fixture_name}`}
                        />
                      </td>
                      <td className="py-2 pr-3 text-xs text-gray-500 dark:text-gray-400">{positions.get(f.fixture_id)}</td>
                      <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">
                        {f.fixture_name}
                        {f.asset_tag && <span className="ml-1 text-xs font-normal text-gray-500">· {f.asset_tag}</span>}
                      </td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{f.project_name || "—"}</td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{f.test_area || "—"}</td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{f.production_line || "—"}</td>
                      <td className="py-2 text-gray-700 dark:text-gray-300">
                        {f.pm_assigned_to || <span className="text-gray-400">Not assigned</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>
                {visible.length} fixture{visible.length === 1 ? "" : "s"} · {selected.size} selected
              </span>
              {pageCount > 1 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={BUTTON_SMALL}
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {pageCount}
                  </span>
                  <button
                    type="button"
                    className={BUTTON_SMALL}
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
