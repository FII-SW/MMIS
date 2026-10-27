// src/pages/Login.jsx

import { useState } from "react";
import API from "../api";
import { Link, useNavigate } from "react-router-dom";
import PasswordVisibilityButton from "../components/PasswordVisibilityButton";
import { CHANGE_PASSWORD_URL } from "../utils/auth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await API.post("/auth/login", { username, password });
      localStorage.setItem("token", res.data.access_token);
      navigate(res.data.must_change_password ? `${CHANGE_PASSWORD_URL}?required=1` : "/dashboard");
    } catch (err) {
      const status = err?.response?.status;
      if (status === 500) {
        setError("Server error during sign-in. Contact your admin or try again shortly.");
      } else if (status === 401) {
        setError("Invalid username or password");
      } else if (!err?.response) {
        setError("Cannot reach the server. Check your network or VPN.");
      } else {
        setError("Invalid username or password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-y-auto bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 py-4 transition-colors sm:items-center dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large Circle - Top Right */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 dark:bg-blue-900 rounded-full opacity-20 blur-3xl"></div>
        
        {/* Medium Circle - Bottom Left */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-200 dark:bg-indigo-900 rounded-full opacity-20 blur-3xl"></div>
        
        {/* Small Circle - Top Left */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-blue-300 dark:bg-blue-800 rounded-full opacity-15 blur-3xl"></div>
        
        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-4 py-4 sm:px-6">
        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl transition-colors sm:p-6 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="mb-4 text-center">
            <h1 className="mb-1 text-3xl font-bold text-blue-600 dark:text-blue-400">MMIS</h1>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Welcome Back</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Sign in to your inventory management system</p>
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Username</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Enter your username"
                className="w-full rounded-lg border-2 border-gray-300 py-2 pl-9 pr-3 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full rounded-lg border-2 border-gray-300 py-2 pl-9 pr-10 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
                onBlur={() => setCapsLock(false)}
                required
                disabled={loading}
              />
              <PasswordVisibilityButton
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
                disabled={loading}
              />
            </div>
            {capsLock && (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                Caps Lock is on
              </p>
            )}
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-center text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none dark:bg-blue-700 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800 dark:disabled:bg-gray-600"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
            <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2.5 text-center dark:border-blue-900/50 dark:bg-blue-950/40">
              <p className="text-xs text-gray-700 dark:text-gray-200">
                New to MMIS?{" "}
                <Link to="/signup" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                  Create an account
                </Link>
              </p>
              <p className="mt-1 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                Starts as Viewer. A Super Admin can raise your access later.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
