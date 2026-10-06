/** Safely decode a JWT payload from localStorage. Returns null if invalid or expired. */
export function decodeToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("token");
}

export const CHANGE_PASSWORD_URL = "/dashboard/change-password";
/** Must match PASSWORD_CHANGE_REQUIRED in backend/app/utils/auth_deps.py */
export const PASSWORD_CHANGE_REQUIRED = "Please change your temporary password before continuing.";

/** True when a Super Admin set a temporary password that must be changed before using MMIS. */
export function mustChangePassword() {
  return Boolean(decodeToken(localStorage.getItem("token"))?.pwd_change);
}

/** Random temporary password without look-alike characters (0/O, 1/l/I). */
export function generateTempPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

/** Read role and employee_id from a valid local JWT (does not verify signature). */
export function getTokenSession() {
  const token = localStorage.getItem("token");
  const payload = decodeToken(token);
  if (!payload) return null;
  return {
    employee_id: payload.employee_id,
    role: normalizeRole(payload.role),
    username: payload.sub,
  };
}

export const ROLE_LABELS = { viewer: "Viewer", user: "User", admin: "Admin", superadmin: "Super Admin" };

/** "Super Admin", "super_admin" and "SUPERADMIN" all become "superadmin". */
export function normalizeRole(role) {
  return String(role || "").toLowerCase().replace(/[\s_-]/g, "");
}

/** Admins and Super Admins can do everything an admin can. */
export function hasAdminAccess(role) {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "superadmin";
}

export function isSuperAdminRole(role) {
  return normalizeRole(role) === "superadmin";
}

export function roleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || (role ? String(role) : "N/A");
}

export function isAdminUser() {
  return hasAdminAccess(getTokenSession()?.role);
}

export function isSuperAdminUser() {
  return isSuperAdminRole(getTokenSession()?.role);
}

/** Viewers can open pages but not request, return, record PMs or change anything. */
export function isViewerRole(role) {
  return normalizeRole(role) === "viewer";
}

export function isViewerUser() {
  return isViewerRole(getTokenSession()?.role);
}
