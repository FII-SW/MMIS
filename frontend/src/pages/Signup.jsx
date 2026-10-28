import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api";
import PasswordVisibilityButton from "../components/PasswordVisibilityButton";
import { apiErrorMessage } from "../utils/apiError";

const FIELD =
  "w-full rounded-lg border-2 border-gray-300 py-2 pl-9 pr-3 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

function FieldIcon({ children }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400 dark:text-gray-500">
      {children}
    </span>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    employee_name: "",
    employee_username: "",
    employee_email: "",
    employee_designation: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const username = form.employee_username.trim();
      const res = await API.post("/auth/signup", {
        employee_name: form.employee_name.trim(),
        employee_username: username,
        employee_email: form.employee_email.trim() || null,
        employee_designation: form.employee_designation.trim() || null,
        password: form.password,
      });
      localStorage.setItem("token", res.data.access_token);
      navigate("/dashboard", {
        replace: true,
        state: {
          signupNotice:
            res.data.message ||
            "Account created. You have Viewer access until a Super Admin changes your role.",
        },
      });
    } catch (err) {
      const status = err?.response?.status;
      if (!err?.response) {
        setError("Cannot reach the server. Check your network or VPN, then try again.");
      } else {
        setError(
          apiErrorMessage(
            err,
            status >= 500
              ? "Server error during sign-up. Ask an admin to check mmis-backend logs, or try again shortly."
              : "Could not create the account. Please try again."
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const ready =
    form.employee_name.trim() && form.employee_username.trim() && form.password && form.confirm;

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-y-auto bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 px-4 py-4 sm:items-center sm:py-6 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-blue-200 opacity-20 blur-3xl dark:bg-blue-900" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-200 opacity-20 blur-3xl dark:bg-indigo-900" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]" />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl transition-colors sm:p-6 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="mb-3 text-center">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 sm:text-3xl">MMIS</h1>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Create an account</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Starts as Viewer — a Super Admin can raise access later.
            </p>
          </div>

          <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-snug text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
            Viewers can browse inventory, reports, documents, and fixtures. Parts, restock, and PMs need higher access.
          </p>

          <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2">
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Full name</span>
              <div className="relative">
                <FieldIcon>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </FieldIcon>
                <input
                  className={FIELD}
                  value={form.employee_name}
                  onChange={set("employee_name")}
                  required
                  maxLength={100}
                  disabled={loading}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Username</span>
              <div className="relative">
                <FieldIcon>
                  <span className="text-sm">@</span>
                </FieldIcon>
                <input
                  className={FIELD}
                  value={form.employee_username}
                  onChange={set("employee_username")}
                  required
                  minLength={3}
                  maxLength={50}
                  disabled={loading}
                  placeholder="Login username"
                  autoComplete="username"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Email <span className="font-normal text-gray-400">(optional)</span>
              </span>
              <div className="relative">
                <FieldIcon>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </FieldIcon>
                <input
                  type="email"
                  className={FIELD}
                  value={form.employee_email}
                  onChange={set("employee_email")}
                  maxLength={255}
                  disabled={loading}
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                Designation <span className="font-normal text-gray-400">(optional)</span>
              </span>
              <div className="relative">
                <FieldIcon>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </FieldIcon>
                <input
                  className={FIELD}
                  value={form.employee_designation}
                  onChange={set("employee_designation")}
                  maxLength={50}
                  disabled={loading}
                  placeholder="Job title"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Password</span>
              <div className="relative">
                <FieldIcon>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </FieldIcon>
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${FIELD} pr-10`}
                  value={form.password}
                  onChange={set("password")}
                  required
                  minLength={6}
                  disabled={loading}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
                <PasswordVisibilityButton
                  visible={showPassword}
                  onToggle={() => setShowPassword((value) => !value)}
                  disabled={loading}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Confirm password</span>
              <div className="relative">
                <FieldIcon>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </FieldIcon>
                <input
                  type={showPassword ? "text" : "password"}
                  className={FIELD}
                  value={form.confirm}
                  onChange={set("confirm")}
                  required
                  minLength={6}
                  disabled={loading}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/20">
              <p className="whitespace-pre-line text-center text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !ready}
            className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none dark:bg-blue-700 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800 dark:disabled:bg-gray-600"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>

          <p className="mt-3 text-center text-xs text-gray-600 dark:text-gray-300">
            Already have an account?{" "}
            <Link to="/" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
