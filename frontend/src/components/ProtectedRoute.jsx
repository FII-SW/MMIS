// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { CHANGE_PASSWORD_URL, decodeToken, clearSession, normalizeRole } from "../utils/auth";

export default function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  const payload = decodeToken(token);
  if (!payload) {
    clearSession();
    return <Navigate to="/" replace />;
  }

  if (payload.pwd_change && !location.pathname.startsWith(CHANGE_PASSWORD_URL)) {
    return <Navigate to={`${CHANGE_PASSWORD_URL}?required=1`} replace />;
  }

  const role = normalizeRole(payload.role);
  const allowed =
    !allowedRoles ||
    allowedRoles.includes(role) ||
    (role === "superadmin" && allowedRoles.includes("admin"));

  if (!allowed) {
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{
          flashMessage: "You do not have permission to open that page. Contact your admin if you need access.",
          flashType: "warning",
        }}
      />
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <div className="app-bg-grid"></div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
