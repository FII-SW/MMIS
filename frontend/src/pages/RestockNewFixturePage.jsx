// src/pages/RestockNewFixturePage.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import ProjectSelector from "../components/ProjectSelector";
import FixtureDescriptorFields from "../components/FixtureDescriptorFields";

export default function RestockNewFixturePage() {
  const navigate = useNavigate();
  const [accessLevel, setAccessLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dropdown states
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showTestAreaDropdown, setShowTestAreaDropdown] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [testAreaSearch, setTestAreaSearch] = useState("");
  const projectRef = useRef(null);
  const testAreaRef = useRef(null);

  // Available options for dropdowns
  const projects = [
    "Common",
    "Astoria",
    "Athena",
    "Turin",
    "Bondi Beach",
    "Zebra Beach",
    "Mandolin Beach",
    "Gulp",
    "Xena",
    "Asahi",
    "Humu Beach",
  ];

  const testAreas = [
    "ICT_Mobo",
    "BSI_Mobo",
    "FBT_Mobo",
    "ICT_Agora",
    "FBT_Agora",
    "TOOLS",
    "ORT",
    "L10_Racks",
  ];

  const [formData, setFormData] = useState({
    fixture_name: "",
    project_name: "",
    test_area: "",
    fixture_number: "", // User enters only the number part
    asset_tag: "",
    fixture_serial_number: "",
    manufacturer: "",
    production_line: "",
  });
  const [employeeId, setEmployeeId] = useState(null);

  // Filtered options for dropdowns
  const filteredProjects = projects.filter(project =>
    project.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const filteredTestAreas = testAreas.filter(area =>
    area.toLowerCase().includes(testAreaSearch.toLowerCase())
  );

  // Load access level and employee_id from token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setAccessLevel(payload.role);
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
      if (projectRef.current && !projectRef.current.contains(event.target)) {
        setShowProjectDropdown(false);
      }
      if (testAreaRef.current && !testAreaRef.current.contains(event.target)) {
        setShowTestAreaDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync search with selected values
  useEffect(() => {
    if (formData.project_name) {
      setProjectSearch(formData.project_name);
    }
  }, [formData.project_name]);

  useEffect(() => {
    if (formData.test_area) {
      setTestAreaSearch(formData.test_area);
    }
  }, [formData.test_area]);

  // Auto-generate fixture_name from project_name, test_area, and fixture_number
  useEffect(() => {
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
    if (!formData.fixture_number) {
      alert("Please fill in all required fields. Fixture Number is required.");
      return;
    }
    if (!formData.project_name) {
      alert("Please fill in all required fields. Project Name is required.");
      return;
    }
    if (!formData.test_area) {
      alert("Please fill in all required fields. Test Area is required.");
      return;
    }

    // Generate final fixture_name
    const finalFixtureName = `${formData.project_name}_${formData.test_area}_${formData.fixture_number}`;

    try {
      await API.post("/fixtures/", {
        fixture_name: finalFixtureName,
        project_name: formData.project_name,
        test_area: formData.test_area,
        asset_tag: formData.asset_tag || "",
        fixture_serial_number: formData.fixture_serial_number || "",
        manufacturer: formData.manufacturer.trim() || null,
        production_line: formData.production_line.trim() || null,
        employee_id: employeeId,  // Include employee_id for activity history
      });

      alert("New fixture added successfully!");
      navigate("/dashboard/restock/project");
    } catch (err) {
      console.error(err);
      alert("Failed to add new fixture");
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
                  setFormData((prev) => ({ ...prev, project_name: e.target.value }));
                  setProjectSearch(e.target.value);
                }}
                placeholder="Select Project Name"
                required
                className="w-full p-3"
              />
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
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
              {showTestAreaDropdown && (
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

            {/* Fixture Number */}
            <div>
              <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                Fixture Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="fixture_number"
                value={formData.fixture_number}
                onChange={handleChange}
                className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                required
                placeholder="e.g., 01 or A01"
              />
              {formData.project_name && formData.test_area && formData.fixture_number && (
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

