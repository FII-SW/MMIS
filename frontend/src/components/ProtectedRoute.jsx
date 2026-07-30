// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { decodeToken, clearSession } from "../utils/auth";

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  const payload = decodeToken(token);
  if (!payload) {
    clearSession();
    return <Navigate to="/" replace />;
  }

  const role = payload.role;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
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
