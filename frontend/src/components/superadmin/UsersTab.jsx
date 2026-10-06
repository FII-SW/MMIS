import { useEffect, useMemo, useState } from "react";
import API from "../../api";
import { apiErrorMessage } from "../../utils/apiError";
import { generateTempPassword, getTokenSession } from "../../utils/auth";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_SMALL, CARD, FIELD, Label, Notice, RoleBadge } from "./ui";

const EMPTY_FORM = {
  employee_name: "",
  employee_username: "",
  employee_badge_number: "",
  password: "",
  require_change: true,
  role: "user",
  employee_email: "",
  employee_designation: "",
  employee_shift: "",
};

/** Visible temporary-password box with Generate / Copy and the "must change" option. */
function TempPasswordField({ label, password, onPassword, requireChange, onRequireChange, autoFocus }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked on http; the password is visible to copy by hand */
    }
  };
  return (
    <div className="sm:col-span-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          className={`${FIELD} font-mono`}
          type="text"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="Type one or click Generate"
        />
        <button type="button" className={BUTTON_SECONDARY} onClick={() => onPassword(generateTempPassword())}>
          Generate
        </button>
        <button type="button" className={BUTTON_SECONDARY} onClick={copy} disabled={!password}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={requireChange} onChange={(e) => onRequireChange(e.target.checked)} />
        Ask them to choose their own password at next sign-in (recommended)
      </label>
    </div>
  );
}

function UserForm({ initial, roles, isNew, isSelf, saving, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <Label>Name *</Label>
          <input className={FIELD} value={form.employee_name} onChange={set("employee_name")} required maxLength={100} />
        </label>
        <label>
          <Label>Badge number *</Label>
          <input className={FIELD} value={form.employee_badge_number} onChange={set("employee_badge_number")} required maxLength={20} />
        </label>
        <label>
          <Label>Username *</Label>
          <input className={FIELD} value={form.employee_username} onChange={set("employee_username")} required maxLength={50} autoComplete="off" />
        </label>
        <label>
          <Label>Access level *</Label>
          <select className={FIELD} value={form.role} onChange={set("role")} disabled={isSelf}>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        {isNew && (
          <TempPasswordField
            label="Starting password * (min 6)"
            password={form.password}
            onPassword={(password) => setForm((prev) => ({ ...prev, password }))}
            requireChange={form.require_change}
            onRequireChange={(require_change) => setForm((prev) => ({ ...prev, require_change }))}
          />
        )}
        <label>
          <Label>Email</Label>
          <input className={FIELD} type="email" value={form.employee_email} onChange={set("employee_email")} maxLength={255} />
        </label>
        <label>
          <Label>Designation</Label>
          <input className={FIELD} value={form.employee_designation} onChange={set("employee_designation")} maxLength={50} />
        </label>
        <label>
          <Label>Shift</Label>
          <input className={FIELD} value={form.employee_shift} onChange={set("employee_shift")} maxLength={20} />
        </label>
      </div>
      {isSelf && (
        <p className="text-xs text-gray-500 dark:text-gray-400">You can&apos;t change your own access level. Ask another Super Admin.</p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON_SECONDARY} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={BUTTON_PRIMARY} disabled={saving}>
          {saving ? "Saving…" : isNew ? "Add user" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function ResetPassword({ user, onDone, onCancel }) {
  const [password, setPassword] = useState(generateTempPassword);
  const [requireChange, setRequireChange] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await API.post(`/admin/users/${user.employee_id}/reset-password`, {
        new_password: password,
        require_change: requireChange,
      });
      onDone(
        `Password reset for ${user.employee_name}. Temporary password: ${password} — give it to them privately.` +
          (requireChange ? " They'll be asked to choose their own password when they sign in." : "")
      );
    } catch (err) {
      setError(apiErrorMessage(err, "Could not reset the password."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TempPasswordField
          label="New temporary password (min 6)"
          password={password}
          onPassword={setPassword}
          requireChange={requireChange}
          onRequireChange={setRequireChange}
          autoFocus
        />
      </div>
      <Notice>{error}</Notice>
      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON_SECONDARY} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={BUTTON_PRIMARY} disabled={saving}>
          {saving ? "Saving…" : "Reset password"}
        </button>
      </div>
    </form>
  );
}

export default function UsersTab() {
  const selfId = getTokenSession()?.employee_id;
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [panel, setPanel] = useState(null); // {mode: "add"|"edit"|"password", user}
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await API.get("/admin/users");
      setUsers(res.data.users || []);
      setRoles(res.data.roles || []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load users."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (!showInactive && !user.active) return false;
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!q) return true;
      return [user.employee_name, user.employee_username, user.employee_badge_number, user.employee_email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q));
    });
  }, [users, search, roleFilter, showInactive]);

  const inactiveCount = users.filter((user) => !user.active).length;

  const done = (message) => {
    setPanel(null);
    setSuccess(message);
    setError("");
    load();
  };

  const saveUser = async (form) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (panel.mode === "add") {
        await API.post("/admin/users", form);
        done(
          `Added ${form.employee_name}. Starting password: ${form.password} — give it to them privately.` +
            (form.require_change ? " They'll choose their own password when they first sign in." : "")
        );
      } else {
        const { password: _password, require_change: _requireChange, ...changes } = form;
        await API.patch(`/admin/users/${panel.user.employee_id}`, changes);
        done(`Saved ${form.employee_name}.`);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save the user."));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (user, active) => {
    if (!active) {
      const note = user.assigned_fixtures
        ? `\n\nTheir ${user.assigned_fixtures} assigned PM fixture(s) will become unassigned.`
        : "";
      if (!window.confirm(`Deactivate ${user.employee_name}? They won't be able to log in. Their history stays.${note}`)) return;
    }
    setError("");
    setSuccess("");
    try {
      await API.patch(`/admin/users/${user.employee_id}`, { active });
      done(`${user.employee_name} is now ${active ? "active" : "deactivated"}.`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not change the account."));
    }
  };

  const editInitial = (user) => ({
    ...EMPTY_FORM,
    employee_name: user.employee_name || "",
    employee_username: user.employee_username || "",
    employee_badge_number: user.employee_badge_number || "",
    role: user.role,
    employee_email: user.employee_email || "",
    employee_designation: user.employee_designation || "",
    employee_shift: user.employee_shift || "",
  });

  return (
    <div className="space-y-4">
      <Notice onClose={() => setError("")}>{error}</Notice>
      <Notice type="success" onClose={() => setSuccess("")}>
        {success}
      </Notice>

      {panel && (
        <div className={CARD}>
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">
            {panel.mode === "add"
              ? "Add user"
              : panel.mode === "edit"
                ? `Edit ${panel.user.employee_name}`
                : `Reset password for ${panel.user.employee_name}`}
          </h3>
          {panel.mode === "password" ? (
            <ResetPassword user={panel.user} onDone={done} onCancel={() => setPanel(null)} />
          ) : (
            <UserForm
              key={panel.user?.employee_id || "new"}
              initial={panel.mode === "add" ? EMPTY_FORM : editInitial(panel.user)}
              roles={roles}
              isNew={panel.mode === "add"}
              isSelf={panel.user?.employee_id === selfId}
              saving={saving}
              onSave={saveUser}
              onCancel={() => setPanel(null)}
            />
          )}
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
              placeholder="Name, username, badge or email"
            />
          </label>
          <label className="w-44">
            <Label>Access level</Label>
            <select className={FIELD} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show deactivated ({inactiveCount})
          </label>
          <button type="button" className={`${BUTTON_PRIMARY} ml-auto`} onClick={() => setPanel({ mode: "add" })}>
            + Add user
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading users…</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No users match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 font-semibold">Username</th>
                  <th className="py-2 pr-3 font-semibold">Badge</th>
                  <th className="py-2 pr-3 font-semibold">Access</th>
                  <th className="py-2 pr-3 font-semibold">Email</th>
                  <th className="py-2 pr-3 font-semibold">Shift</th>
                  <th className="py-2 pr-3 text-right font-semibold">PM fixtures</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {visible.map((user) => {
                  const isSelf = user.employee_id === selfId;
                  return (
                    <tr key={user.employee_id} className={user.active ? "" : "opacity-60"}>
                      <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">
                        {user.employee_name}
                        {isSelf && <span className="ml-1 text-xs text-gray-500">(you)</span>}
                        {user.employee_designation && (
                          <div className="text-xs font-normal text-gray-500 dark:text-gray-400">{user.employee_designation}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{user.employee_username}</td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{user.employee_badge_number}</td>
                      <td className="py-2 pr-3">
                        <RoleBadge role={user.role} label={user.role_label} />
                      </td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{user.employee_email || "—"}</td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{user.employee_shift || "—"}</td>
                      <td className="py-2 pr-3 text-right text-gray-700 dark:text-gray-300">{user.assigned_fixtures || "—"}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`text-xs font-semibold ${
                            user.active ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {user.active ? "Active" : "Deactivated"}
                        </span>
                        {user.active && user.must_change_password && (
                          <div
                            className="text-[11px] font-medium text-amber-700 dark:text-amber-400"
                            title="Still using the temporary password from a Super Admin"
                          >
                            🔒 Temp password
                          </div>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button type="button" className={BUTTON_SMALL} onClick={() => setPanel({ mode: "edit", user })}>
                            Edit
                          </button>
                          <button type="button" className={BUTTON_SMALL} onClick={() => setPanel({ mode: "password", user })}>
                            Reset password
                          </button>
                          {!isSelf &&
                            (user.active ? (
                              <button
                                type="button"
                                className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                onClick={() => setActive(user, false)}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rounded-md border border-green-300 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
                                onClick={() => setActive(user, true)}
                              >
                                Activate
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
