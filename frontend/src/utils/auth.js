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

/** Read role and employee_id from a valid local JWT (does not verify signature). */
export function getTokenSession() {
  const token = localStorage.getItem("token");
  const payload = decodeToken(token);
  if (!payload) return null;
  return {
    employee_id: payload.employee_id,
    role: String(payload.role || "").toLowerCase(),
    username: payload.sub,
  };
}

export function isAdminUser() {
  return getTokenSession()?.role === "admin";
}
