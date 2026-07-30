// src/pages/ProfilePage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";

export default function ProfilePage() {
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const employeeId = payload.employee_id;

      // Fetch employee details
      API.get(`/employees/${employeeId}`)
        .then((res) => {
          setEmployeeData(res.data);
        })
        .catch((err) => {
          console.error("Error loading employee data:", err);
          alert("Failed to load profile data");
        })
        .finally(() => setLoading(false));
    } catch (err) {
      console.error("Error decoding token:", err);
      setLoading(false);
    }
  }, [navigate]);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (loading) {
    return (
      <PageLoadingState title="My Profile" onBack={() => navigate("/dashboard")} message="Loading profile..." />
    );
  }

  if (!employeeData) {
    return (
      <div className="min-h-screen bg-transparent">
        <Header />
        <PageHeaderWithBack title="My Profile" onBack={() => navigate("/dashboard")} />
        <div className="flex items-center justify-center min-h-[40vh] px-4">
          <p className="text-red-500 dark:text-red-400">Failed to load profile data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <Header />

      <PageHeaderWithBack title="My Profile" onBack={() => navigate("/dashboard")} />

      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
          {/* Profile Header */}
          <div className="flex items-center gap-6 mb-8 pb-6 border-b border-gray-200">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center font-bold text-white text-3xl shadow-lg">
              {employeeData.employee_name
                ? employeeData.employee_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                : "U"}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-800">
                {employeeData.employee_name || "User"}
              </h2>
            </div>
          </div>

          {/* Profile Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Personal Information
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Full Name</label>
                  <p className="text-lg text-gray-800">{employeeData.employee_name || "N/A"}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Designation</label>
                  <p className="text-lg text-gray-800">{employeeData.employee_designation || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* Work Information */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Work Information
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Access Level</label>
                  <p className="text-lg text-gray-800">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      employeeData.employee_access_level === "admin"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {employeeData.employee_access_level?.toUpperCase() || "N/A"}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Shift</label>
                  <p className="text-lg text-gray-800">{employeeData.employee_shift || "N/A"}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Username</label>
                  <p className="text-lg text-gray-800 font-mono">{employeeData.employee_username || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => navigate("/dashboard/change-password")}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>🔒</span>
              <span>Change Password</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

