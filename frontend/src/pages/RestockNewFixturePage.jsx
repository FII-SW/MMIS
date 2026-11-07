// src/pages/RestockNewFixturePage.jsx
import { useEffect, useState, useRef } from "react";
import { hasAdminAccess } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import API from "../api";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import ProjectSelector from "../components/ProjectSelector";
import FixtureDescriptorFields from "../components/FixtureDescriptorFields";
import { testAreasForProject } from "../utils/testAreas";
import {
  IC_PROGRAMMING_PROJECT,
  IC_PROGRAMMING_TEST_AREA,
  isIcProgrammingProject,
} from "../utils/icProgramming";

export default function RestockNewFixturePage() {
  const navigate = useNavigate();
  const [accessLevel, setAccessLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dropdown states
  const [showTestAreaDropdown, setShowTestAreaDropdown] = useState(false);
  const [testAreaSearch, setTestAreaSearch] = useState("");
  const testAreaRef = useRef(null);

  const [formData, setFormData] = useState({
    fixture_name: "",
    project_name: "",
    test_area: "",
    fixture_number: "", // number suffix OR full machine name for IC Programming
    asset_tag: "",
    fixture_serial_number: "",
    manufacturer: "",
    production_line: "",
  });
  const [employeeId, setEmployeeId] = useState(null);

  const isIcProgramming = isIcProgrammingProject(formData.project_name);
  const testAreas = testAreasForProject(formData.project_name);

  const filteredTestAreas = testAreas.filter((area) =>
    area.toLowerCase().includes(testAreaSearch.toLowerCase())
  );

  // Load access level and employee_id from token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setAccessLevel(hasAdminAccess(payload.role) ? "admin" : payload.role);
        setEmployeeId(payload.employee_id);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    setLoading(false);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (testAreaRef.current && !testAreaRef.current.contains(event.target)) {
        setShowTestAreaDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (formData.test_area) {
      setTestAreaSearch(formData.test_area);
    }
  }, [formData.test_area]);

  // Auto-generate fixture_name (skip for IC Programming — machine name is entered as-is)
  useEffect(() => {
    if (isIcProgrammingProject(formData.project_name)) {
      setFormData((prev) => ({
        ...prev,
        fixture_name: (prev.fixture_number || "").trim(),
        test_area: prev.test_area || IC_PROGRAMMING_TEST_AREA,
      }));
      return;
    }
    if (formData.project_name && formData.test_area && formData.fixture_number) {
      const generatedName = `${formData.project_name}_${formData.test_area}_${formData.fixture_number}`;
      setFormData((prev) => ({
        ...prev,
        fixture_name: generatedName,
      }));
    }
  }, [formData.project_name, formData.test_area, formData.fixture_number]);

  // Check if user is admin
  if (loading) {
    return (
      <PageLoadingState
        title="New Fixture"
        onBack={() => navigate("/dashboard/restock/project/add-new")}
      />
    );
  }

  if (accessLevel !== "admin") {
    return (
      <AccessDenied feature="the Restock feature" backTo="/dashboard/restock/project/add-new" />
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    const icMode = isIcProgrammingProject(formData.project_name);
    if (!formData.fixture_number.trim()) {
      alert(
        icMode
          ? "Machine name is required (e.g. AT3-310B1)."
          : "Please fill in all required fields. Fixture Number is required."
      );
      return;
    }
    if (!formData.project_name) {
      alert("Please fill in all required fields. Project Name is required.");
      return;
    }
    const testArea = icMode
      ? formData.test_area || IC_PROGRAMMING_TEST_AREA
      : formData.test_area;
    if (!testArea) {
      alert("Please fill in all required fields. Test Area is required.");
      return;
    }

    const finalFixtureName = icMode
      ? formData.fixture_number.trim()
      : `${formData.project_name}_${testArea}_${formData.fixture_number}`;

    try {
      await API.post("/fixtures/", {
        fixture_name: finalFixtureName,
        project_name: icMode ? IC_PROGRAMMING_PROJECT : formData.project_name,
        test_area: testArea,
        asset_tag: formData.asset_tag || "",
        fixture_serial_number: formData.fixture_serial_number || "",
        manufacturer: formData.manufacturer.trim() || null,
        production_line: formData.production_line.trim() || null,
        employee_id: employeeId,
      });

      alert(icMode ? "Machine added successfully!" : "New fixture added successfully!");
      navigate("/dashboard/restock/project");
    } catch (err) {
      console.error(err);
      alert(icMode ? "Failed to add machine" : "Failed to add new fixture");
    }
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="New Fixture" onBack={() => navigate("/dashboard/restock/project/add-new")} />

      <div className="max-w-2xl mx-auto px-8">
        {/* FORM */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-lg p-8 mb-8 transition-colors">
          <div className="space-y-6">
            {/* Project Name - Searchable Dropdown */}
            <div>
              <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                Project Name <span className="text-red-500">*</span>
              </label>
              <ProjectSelector
                value={formData.project_name}
                onChange={(e) => {
                  const project = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    project_name: project,
                    test_area: isIcProgrammingProject(project)
                      ? IC_PROGRAMMING_TEST_AREA
                      : prev.test_area === IC_PROGRAMMING_TEST_AREA
                        ? ""
                        : prev.test_area,
                  }));
                  if (isIcProgrammingProject(project)) {
                    setTestAreaSearch(IC_PROGRAMMING_TEST_AREA);
                  }
                }}
                placeholder="Select Project Name"
                required
                className="w-full p-3"
              />
              {isIcProgramming && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  IC Programming is the shared programmer cell. Enter the machine model as the name (AT3-310A2, …).
                </p>
              )}
            </div>

            {/* Test Area - Searchable Dropdown */}
            <div className="relative" ref={testAreaRef}>
              <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                Test Area <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={testAreaSearch}
                onChange={(e) => {
                  setTestAreaSearch(e.target.value);
                  setShowTestAreaDropdown(true);
                }}
                onFocus={() => setShowTestAreaDropdown(true)}
                placeholder="Select Test Area"
                disabled={isIcProgramming}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-70"
              />
              {showTestAreaDropdown && !isIcProgramming && (
                <div className="dropdown-menu absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-auto transition-colors">
                  {filteredTestAreas.length > 0 ? (
                    filteredTestAreas.map((area) => (
                      <div
                        key={area}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, test_area: area }));
                          setTestAreaSearch(area);
                          setShowTestAreaDropdown(false);
                        }}
                        className="p-2 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer text-gray-700 dark:text-gray-300 transition-colors"
                      >
                        {area}
                      </div>
                    ))
                  ) : (
                    <div className="p-2 text-gray-500 dark:text-gray-400">No test area found</div>
                  )}
                </div>
              )}
            </div>

            {/* Fixture Number / Machine name */}
            <div>
              <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                {isIcProgramming ? "Machine name" : "Fixture Number"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="fixture_number"
                value={formData.fixture_number}
                onChange={handleChange}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                required
                placeholder={isIcProgramming ? "e.g., AT3-310B1" : "e.g., 01 or A01"}
              />
              {isIcProgramming && formData.fixture_number.trim() ? (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Machine:{" "}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {formData.fixture_number.trim()}
                  </span>
                </p>
              ) : null}
              {!isIcProgramming &&
                formData.project_name &&
                formData.test_area &&
                formData.fixture_number && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Full Fixture Name: <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {formData.project_name}_{formData.test_area}_{formData.fixture_number}
                  </span>
                </p>
              )}
            </div>

            {/* Asset Tag */}
            <div>
              <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                Asset Tag
              </label>
              <input
                type="text"
                name="asset_tag"
                value={formData.asset_tag}
                onChange={handleChange}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter asset tag (optional)"
              />
            </div>

            {/* Fixture Serial Number */}
            <div>
              <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                Fixture Serial Number
              </label>
              <input
                type="text"
                name="fixture_serial_number"
                value={formData.fixture_serial_number}
                onChange={handleChange}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter fixture serial number (optional)"
              />
            </div>

            <FixtureDescriptorFields
              manufacturer={formData.manufacturer}
              productionLine={formData.production_line}
              onChange={(name, value) => setFormData((prev) => ({ ...prev, [name]: value }))}
            />
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex justify-center gap-6 mb-8">
          <button
            className="px-8 py-3 bg-blue-200 dark:bg-blue-700 dark:text-white text-blue-800 rounded-md hover:bg-blue-300 dark:hover:bg-blue-600 shadow-md font-medium transition-colors"
            onClick={() => navigate("/dashboard/restock/project/add-new")}
          >
            Back
          </button>

          <button
            className="px-8 py-3 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 shadow-md font-medium transition-colors"
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

