import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import ProjectSelector from "../components/ProjectSelector";
import { getProjects } from "../utils/projects";
import { getTestAreas } from "../utils/testAreas";
import { projectRequiresTestArea } from "../utils/inventoryRules";

export default function RestockNewStockPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const project = params.get("project");

  const testAreas = getTestAreas();

  const itemTypes = [
    "part",
    "tool",
  ];

  const [formData, setFormData] = useState({
    item_name: "",
    project_name: project || "",
    item_part_number: "",
    item_description: "",
    test_area: "",
    item_unit: "",
    item_current_quantity: "",
    item_unit_price: "",
    item_min_count: "",
    item_manufacturer: "",
    item_type: "",
    item_life_cycle: "",
    item_image_url: "",
    remarks: "",
  });
  const [employeeId, setEmployeeId] = useState(null);
  const [accessLevel, setAccessLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const fieldClass = (key) =>
    `w-full p-2 border rounded transition-colors dark:bg-gray-700 dark:text-white ${
      fieldErrors[key]
        ? "border-red-500 dark:border-red-500"
        : "border-gray-300 dark:border-gray-600"
    }`;

  const RequiredLabel = ({ children }) => (
    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
      {children} <span className="text-red-600 dark:text-red-400">*</span>
    </label>
  );

  // Load employee_id and access level
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setEmployeeId(payload.employee_id);
        // Token stores access level as "role" field
        setAccessLevel(payload.role);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    setLoading(false);
  }, []);

  // Check if user is admin
  if (loading) {
    return (
      <PageLoadingState
        title="New Stock"
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
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.item_name.trim()) {
      errors.item_name = "Name is required.";
    }
    if (!formData.project_name.trim()) {
      errors.project_name = "Project name is required.";
    }
    if (!formData.item_part_number.trim()) {
      errors.item_part_number = "Part number is required.";
    }
    const needsTestArea = projectRequiresTestArea(formData.project_name);
    if (needsTestArea && !formData.test_area.trim()) {
      errors.test_area = "Test area is required for this project.";
    }
    const qtyRaw = formData.item_current_quantity;
    if (qtyRaw === "" || qtyRaw === null || qtyRaw === undefined) {
      errors.item_current_quantity = "Current quantity is required.";
    } else {
      const qty = Number(qtyRaw);
      if (Number.isNaN(qty) || qty < 0) {
        errors.item_current_quantity = "Enter a valid quantity (0 or greater).";
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedFile) {
      return null;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      // Get API base URL (same logic as api.js)
      const apiBaseUrl = import.meta.env.VITE_API_URL || 
        (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8000');

      const response = await fetch(`${apiBaseUrl}/inventory/upload-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setUploading(false);
      return data.image_url;
    } catch (error) {
      console.error("Error uploading image:", error);
      setUploading(false);
      alert("Failed to upload image. Please try again.");
      return null;
    }
  };

  const submitInventory = async (imageUrl) => {
    const res = await API.post("/inventory/", {
      item_name: formData.item_name.trim(),
      project_name: formData.project_name.trim(),
      item_part_number: formData.item_part_number.trim(),
      item_description: formData.item_description.trim() || null,
      test_area: formData.test_area.trim() || null,
      item_unit: formData.item_unit || null,
      item_current_quantity: parseInt(formData.item_current_quantity, 10),
      item_unit_price: formData.item_unit_price || null,
      item_min_count: parseInt(formData.item_min_count) || 0,
      item_manufacturer: formData.item_manufacturer || null,
      item_type: formData.item_type || null,
      item_life_cycle: parseInt(formData.item_life_cycle) || null,
      item_image_url: imageUrl || null,
      employee_id: employeeId,
    });
    return res;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      // Upload image first if file is selected
      let imageUrl = formData.item_image_url;
      if (selectedFile) {
        imageUrl = await handleImageUpload();
        if (!imageUrl && !formData.item_image_url) {
          return;
        }
      }

      const res = await submitInventory(imageUrl);

      alert(`New item created successfully (ID ${res.data.item_id}).`);
      navigate("/dashboard/restock");
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      alert(typeof detail === "string" ? detail : detail?.message || "Failed to add new stock item");
    }
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="New Stock" onBack={() => navigate("/dashboard/restock/project/add-new")} />

      <div className="max-w-5xl mx-auto px-8">
        {/* FORM */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow p-6 mb-8 transition-colors">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Fields marked with <span className="text-red-600 dark:text-red-400">*</span> are required.
            Each submission creates a <strong>new inventory row</strong> for any project — Astoria, Mandolin Beach, Hi-Lo, custom projects, etc.
            Similar names in the same project do not update existing stock. Use <strong>Restock → Existing item</strong> to add quantity.
          </p>
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              <div>
                <RequiredLabel>Name</RequiredLabel>
                <input
                  type="text"
                  name="item_name"
                  value={formData.item_name}
                  onChange={handleChange}
                  className={fieldClass("item_name")}
                  required
                />
                {fieldErrors.item_name && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.item_name}</p>
                )}
              </div>
              <div>
                <RequiredLabel>Project Name</RequiredLabel>
                <ProjectSelector
                  value={formData.project_name}
                  onChange={handleChange}
                  placeholder="Select Project Name"
                  inputClassName={fieldClass("project_name")}
                  required
                />
                {fieldErrors.project_name && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.project_name}</p>
                )}
              </div>
              <div>
                <RequiredLabel>Part Number</RequiredLabel>
                <input
                  type="text"
                  name="item_part_number"
                  value={formData.item_part_number}
                  onChange={handleChange}
                  className={fieldClass("item_part_number")}
                  required
                />
                {fieldErrors.item_part_number && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.item_part_number}</p>
                )}
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Description</label>
                <input
                  type="text"
                  name="item_description"
                  value={formData.item_description}
                  onChange={handleChange}
                  className={fieldClass("item_description")}
                />
              </div>
              <div>
                {projectRequiresTestArea(formData.project_name) ? (
                  <RequiredLabel>Test Area</RequiredLabel>
                ) : (
                  <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                    Test Area <span className="text-gray-400 font-normal">(not used for this project)</span>
                  </label>
                )}
                <select
                  name="test_area"
                  value={formData.test_area}
                  onChange={handleChange}
                  className={fieldClass("test_area")}
                  disabled={!projectRequiresTestArea(formData.project_name)}
                  required={projectRequiresTestArea(formData.project_name)}
                >
                  <option value="">
                    {projectRequiresTestArea(formData.project_name)
                      ? "Select Test Area"
                      : "Not required"}
                  </option>
                  {testAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                {fieldErrors.test_area && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.test_area}</p>
                )}
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Unit</label>
                <input
                  type="text"
                  name="item_unit"
                  value={formData.item_unit}
                  onChange={handleChange}
                  className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                  placeholder="liters, lbs"
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              <div>
                <RequiredLabel>Current Quantity</RequiredLabel>
                <input
                  type="number"
                  name="item_current_quantity"
                  value={formData.item_current_quantity}
                  onChange={handleChange}
                  className={fieldClass("item_current_quantity")}
                  min="0"
                  required
                />
                {fieldErrors.item_current_quantity && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.item_current_quantity}</p>
                )}
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Unit Price</label>
                <input
                  type="text"
                  name="item_unit_price"
                  value={formData.item_unit_price}
                  onChange={handleChange}
                  className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                  placeholder="e.g., $10.50"
                />
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Minimum Count</label>
                <input
                  type="number"
                  name="item_min_count"
                  value={formData.item_min_count}
                  onChange={handleChange}
                  className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                />
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Manufacturer</label>
                <input
                  type="text"
                  name="item_manufacturer"
                  value={formData.item_manufacturer}
                  onChange={handleChange}
                  className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                />
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Type</label>
                <select
                  name="item_type"
                  value={formData.item_type}
                  onChange={handleChange}
                  className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                >
                  <option value="">Select Type</option>
                  {itemTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Life Cycle</label>
                <input
                  type="number"
                  name="item_life_cycle"
                  value={formData.item_life_cycle}
                  onChange={handleChange}
                  className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                />
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                  Item Image
                </label>
                
                {/* File Upload */}
                <div className="mb-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Upload an image file (JPG, PNG, GIF, WebP)
                  </p>
                </div>

                {/* Image Preview */}
                {imagePreview && (
                  <div className="mb-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded border dark:border-gray-600"
                    />
                  </div>
                )}

                {/* Manual URL Input (Alternative) */}
                <div>
                  <label className="block mb-2 text-sm text-gray-600 dark:text-gray-400">
                    Or enter image URL manually:
                  </label>
                  <input
                    type="text"
                    name="item_image_url"
                    value={formData.item_image_url}
                    onChange={handleChange}
                    className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors text-sm"
                    placeholder="/uploads/item_images/filename.jpg or https://..."
                    disabled={!!selectedFile}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM FIELD */}
          <div className="mt-6">
            <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Remarks (Optional)</label>
            <input
              type="text"
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
              placeholder="Any notes..."
            />
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex justify-center gap-6 mb-8">
          <button
            className="px-8 py-2 bg-blue-200 dark:bg-blue-700 dark:text-white rounded hover:bg-blue-300 dark:hover:bg-blue-600 shadow transition-colors"
            onClick={() => navigate("/dashboard/restock/project/add-new")}
          >
            Back
          </button>

          <button
            className="px-8 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 shadow transition-colors"
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </div>

    </div>
  );
}

