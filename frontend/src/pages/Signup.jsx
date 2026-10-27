import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api";
import PasswordVisibilityButton from "../components/PasswordVisibilityButton";
import { apiErrorMessage } from "../utils/apiError";

const FIELD =
  "w-full rounded-lg border-2 border-gray-300 py-3 pl-10 pr-4 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    employee_name: "",
    employee_badge_number: "",
    employee_username: "",
    employee_email: "",
    employee_designation: "",
    employee_shift: "",
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
      const res = await API.post("/auth/signup", {
        employee_name: form.employee_name.trim(),
        employee_badge_number: form.employee_badge_number.trim(),
        employee_username: form.employee_username.trim(),
        employee_email: form.employee_email.trim() || null,
        employee_designation: form.employee_designation.trim() || null,
        employee_shift: form.employee_shift.trim() || null,
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
      setError(apiErrorMessage(err, "Could not create the account. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const ready =
    form.employee_name.trim() &&
    form.employee_badge_number.trim() &&
    form.employee_username.trim() &&
    form.password &&
    form.confirm;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 transition-colors dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-blue-200 opacity-20 blur-3xl dark:bg-blue-900" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-200 opacity-20 blur-3xl dark:bg-indigo-900" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)]" />
      </div>

      <div className="relative z-10 w-full max-w-lg px-6 py-10">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-100 bg-white p-8 shadow-2xl transition-colors dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-4xl font-bold text-blue-600 dark:text-blue-400">MMIS</h1>
            <h2 className="mb-1 text-2xl font-semibold text-gray-800 dark:text-gray-200">Create an account</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              New accounts start with <span className="font-semibold text-gray-700 dark:text-gray-200">Viewer</span>{" "}
              access. A Super Admin can raise your access level later.
            </p>
          </div>

          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
            Viewer can look at inventory, reports, documents, and fixture status, but cannot request parts, restock, or
            record PMs until access is changed.
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Full name *</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
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
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Badge number *</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">#</span>
                <input
                  className={FIELD}
                  value={form.employee_badge_number}
                  onChange={set("employee_badge_number")}
                  required
                  maxLength={20}
                  disabled={loading}
                  placeholder="Employee badge"
                  autoComplete="off"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Username *</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">@</span>
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

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  type="email"
                  className={FIELD}
                  value={form.employee_email}
                  onChange={set("employee_email")}
                  maxLength={255}
                  disabled={loading}
                  placeholder="Optional"
                  autoComplete="email"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Designation</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  className={FIELD}
                  value={form.employee_designation}
                  onChange={set("employee_designation")}
                  maxLength={50}
                  disabled={loading}
                  placeholder="Optional"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Shift</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <input
                  className={FIELD}
                  value={form.employee_shift}
                  onChange={set("employee_shift")}
                  maxLength={20}
                  disabled={loading}
                  placeholder="Optional"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Password *</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${FIELD} pr-11`}
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
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm password *</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
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
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="whitespace-pre-line text-center text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !ready}
            className="mt-6 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none dark:bg-blue-700 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-800 dark:disabled:bg-gray-600"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>

          <p className="mt-5 text-center text-sm text-gray-600 dark:text-gray-300">
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
