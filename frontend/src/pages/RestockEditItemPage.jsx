import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import API from "../api";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import { getProjects } from "../utils/projects";

export default function RestockEditItemPage() {
  const { item_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Read project & test_area from URL
  const queryParams = new URLSearchParams(location.search);
  const project = queryParams.get("project");
  const test_area = queryParams.get("test_area");
  const simpleRestockProjects = ["Development", "Hi-Lo", "Flying Probe"];
  const isSimpleRestockProject = simpleRestockProjects.includes(project || "");

  const [item, setItem] = useState(null);
  const [formData, setFormData] = useState({
    item_id: "",
    item_name: "",
    item_part_number: "",
    item_description: "",
    test_area: "",
    project_name: "",
    item_unit: "",
    item_min_count: "",
    item_manufacturer: "",
    item_type: "",
    item_life_cycle: "",
    item_current_quantity: "",
    item_unit_price: "",
    item_image_url: "",
    quantity_to_add: "", // New field for quantity being added
    remarks: "",
  });
  const [employeeId, setEmployeeId] = useState(null);
  const [accessLevel, setAccessLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [projects, setProjects] = useState(getProjects());

  // Reload projects when component mounts or when projects are updated
  useEffect(() => {
    const handleProjectsUpdate = () => {
      setProjects(getProjects());
    };

    // Listen for custom event and storage changes
    window.addEventListener('projectsUpdated', handleProjectsUpdate);
    window.addEventListener('storage', handleProjectsUpdate);

    return () => {
      window.removeEventListener('projectsUpdated', handleProjectsUpdate);
      window.removeEventListener('storage', handleProjectsUpdate);
    };
  }, []);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
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

  // Load item details
  useEffect(() => {
    if (!item_id) return;
    
    API.get(`/inventory/${item_id}`)
      .then((res) => {
        const itemData = res.data;
        setItem(itemData);
        setFormData({
          item_id: itemData.item_id || "",
          item_name: itemData.item_name || "",
          item_part_number: itemData.item_part_number || "",
          item_description: itemData.item_description || "",
          test_area: itemData.test_area || "",
          project_name: itemData.project_name || "",
          item_unit: itemData.item_unit || "",
          item_min_count: itemData.item_min_count || "",
          item_manufacturer: itemData.item_manufacturer || "",
          item_type: itemData.item_type || "",
          item_life_cycle: itemData.item_life_cycle || "",
          item_current_quantity: itemData.item_current_quantity || "",
          item_unit_price: itemData.item_unit_price || "",
          item_image_url: itemData.item_image_url || "",
          quantity_to_add: "", // Initialize empty
          remarks: "",
        });
      })
      .catch((err) => console.error("Error loading item:", err));
  }, [item_id]);

  const handleBack = () => {
    let url = `/dashboard/restock/items?project=${encodeURIComponent(project || "")}`;
    if (test_area) {
      url += `&test_area=${encodeURIComponent(test_area)}`;
    }
    navigate(url);
  };

  // NOW WE CAN DO CONDITIONAL RETURNS AFTER ALL HOOKS
  // Check if user is admin
  if (loading) {
    return <PageLoadingState title="Restock" onBack={() => navigate("/dashboard/restock/project")} />;
  }

  if (accessLevel !== "admin") {
    return <AccessDenied feature="the Restock feature" backTo="/dashboard" />;
  }

  if (!item) {
    return <PageLoadingState title="Restock" onBack={handleBack} message="Loading item..." />;
  }

  // Helper function to get full image URL
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    // If it's already a full URL, return as is
    if (imageUrl.startsWith('http')) return imageUrl;
    // Get API base URL (same logic as api.js)
    const apiBaseUrl = import.meta.env.VITE_API_URL || 
      (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8000');
    // Prepend the API base URL
    return `${apiBaseUrl}${imageUrl}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

      const response = await fetch(`${apiBaseUrl}/inventory/upload-image/${item_id}`, {
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
      setFormData(prev => ({ ...prev, item_image_url: data.image_url }));
      setSelectedFile(null);
      setImagePreview(null);
      return data.image_url;
    } catch (error) {
      console.error("Error uploading image:", error);
      setUploading(false);
      alert("Failed to upload image. Please try again.");
      return null;
    }
  };

  // Save only attribute changes (no quantity required)
  const handleSaveChanges = async () => {
    try {
      const updateData = {
        item_name: formData.item_name,
        item_part_number: formData.item_part_number || null,
        item_description: formData.item_description || null,
        test_area: formData.test_area || null,
        project_name: formData.project_name || null,
        item_unit: formData.item_unit || null,
        item_min_count: parseInt(formData.item_min_count) || 0,
        item_manufacturer: formData.item_manufacturer || null,
        item_type: formData.item_type || null,
        item_life_cycle: parseInt(formData.item_life_cycle) || 0,
        item_unit_price: formData.item_unit_price || null,
        item_image_url: formData.item_image_url || null,
        item_current_quantity: parseInt(formData.item_current_quantity) || 0,
      };

      await API.put(`/inventory/${item_id}`, updateData);
      alert("Item details updated successfully!");
      setIsEditMode(false);

      // Refresh item data
      const res = await API.get(`/inventory/${item_id}`);
      setItem(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to update item: " + (err.response?.data?.detail || err.message));
    }
  };

  // Restock (add quantity) - works independently of edit mode
  const handleRestock = async () => {
    if (!formData.quantity_to_add || parseFloat(formData.quantity_to_add) <= 0) {
      alert("Please enter a valid quantity to add (must be greater than 0)");
      return;
    }

    try {
      const quantityToAdd = parseFloat(formData.quantity_to_add);

      // If in edit mode, save attribute changes first
      if (isEditMode) {
        await handleSaveChanges();
      }

      // Then restock the item
      await API.post("/inventory/restock", {
        item_id: parseInt(item_id),
        quantity: quantityToAdd,
        remarks: formData.remarks || "",
        employee_id: employeeId,
      });

      alert("Item restocked successfully!");
      let backUrl = `/dashboard/restock/items?project=${encodeURIComponent(project || "")}`;
      if (test_area) {
        backUrl += `&test_area=${encodeURIComponent(test_area)}`;
      }
      navigate(backUrl);
    } catch (err) {
      console.error(err);
      alert("Failed to restock item: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Restock" onBack={handleBack} />

      <div className="max-w-5xl mx-auto px-8">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-6 py-2 rounded shadow transition ${
              isEditMode
                ? "bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600"
                : "bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
            }`}
          >
            {isEditMode ? "Cancel Edit" : "Edit Details"}
          </button>
        </div>

        {/* FORM */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow p-6 mb-8 transition-colors">
          {isSimpleRestockProject && !isEditMode ? (
            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Item</label>
                <div className="p-3 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                  {formData.item_name || "Item"}
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Current Quantity</label>
                <div className="p-3 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                  {formData.item_current_quantity}
                </div>
              </div>
              <div>
                <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Adding Quantity</label>
                <input
                  type="number"
                  name="quantity_to_add"
                  value={formData.quantity_to_add}
                  onChange={handleChange}
                  className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                  placeholder="Enter quantity to add"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
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
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* LEFT COLUMN */}
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Item ID</label>
                    <input
                      type="text"
                      name="item_id"
                      value={formData.item_id}
                      onChange={handleChange}
                      className="w-full p-2 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-300 transition-colors"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Name</label>
                    <input
                      type="text"
                      name="item_name"
                      value={formData.item_name}
                      onChange={handleChange}
                      className={`w-full p-2 border dark:border-gray-600 rounded transition-colors ${isEditMode ? "bg-white dark:bg-gray-700 dark:text-white" : "bg-gray-100 dark:bg-gray-700 dark:text-gray-300"}`}
                      readOnly={!isEditMode}
                      required={isEditMode}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Part Number</label>
                    <input
                      type="text"
                      name="item_part_number"
                      value={formData.item_part_number}
                      onChange={handleChange}
                      className={`w-full p-2 border dark:border-gray-600 rounded transition-colors ${isEditMode ? "bg-white dark:bg-gray-700 dark:text-white" : "bg-gray-100 dark:bg-gray-700 dark:text-gray-300"}`}
                      readOnly={!isEditMode}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Description</label>
                    <input
                      type="text"
                      name="item_description"
                      value={formData.item_description}
                      onChange={handleChange}
                      className={`w-full p-2 border dark:border-gray-600 rounded transition-colors ${isEditMode ? "bg-white dark:bg-gray-700 dark:text-white" : "bg-gray-100 dark:bg-gray-700 dark:text-gray-300"}`}
                      readOnly={!isEditMode}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Test Area</label>
                    {isEditMode ? (
                      <select
                        name="test_area"
                        value={formData.test_area}
                        onChange={handleChange}
                        className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                      >
                        <option value="">Select Test Area</option>
                        <option value="ICT_Mobo">ICT_Mobo</option>
                        <option value="BSI_Mobo">BSI_Mobo</option>
                        <option value="FBT_Mobo">FBT_Mobo</option>
                        <option value="ICT_Agora">ICT_Agora</option>
                        <option value="FBT_Agora">FBT_Agora</option>
                        <option value="TOOLS">TOOLS</option>
                        <option value="ORT">ORT</option>
                        <option value="L10_Racks">L10_Racks</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="test_area"
                        value={formData.test_area}
                        onChange={handleChange}
                        className="w-full p-2 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-300 transition-colors"
                        readOnly
                      />
                    )}
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Project Name</label>
                    {isEditMode ? (
                      <select
                        name="project_name"
                        value={formData.project_name}
                        onChange={handleChange}
                        className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                      >
                        <option value="">Select Project</option>
                        {projects.map((proj) => (
                          <option key={proj} value={proj}>
                            {proj}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="project_name"
                        value={formData.project_name}
                        onChange={handleChange}
                        className="w-full p-2 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-300 transition-colors"
                        readOnly
                      />
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Unit</label>
                    <input
                      type="text"
                      name="item_unit"
                      value={formData.item_unit}
                      onChange={handleChange}
                      className={`w-full p-2 border dark:border-gray-600 rounded transition-colors ${isEditMode ? "bg-white dark:bg-gray-700 dark:text-white" : "bg-gray-100 dark:bg-gray-700 dark:text-gray-300"}`}
                      placeholder="liters, lbs"
                      readOnly={!isEditMode}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Minimum Count</label>
                    <input
                      type="number"
                      name="item_min_count"
                      value={formData.item_min_count}
                      onChange={handleChange}
                      className={`w-full p-2 border dark:border-gray-600 rounded transition-colors ${isEditMode ? "bg-white dark:bg-gray-700 dark:text-white" : "bg-gray-100 dark:bg-gray-700 dark:text-gray-300"}`}
                      readOnly={!isEditMode}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Manufacturer</label>
                    <input
                      type="text"
                      name="item_manufacturer"
                      value={formData.item_manufacturer}
                      onChange={handleChange}
                      className={`w-full p-2 border dark:border-gray-600 rounded transition-colors ${isEditMode ? "bg-white dark:bg-gray-700 dark:text-white" : "bg-gray-100 dark:bg-gray-700 dark:text-gray-300"}`}
                      readOnly={!isEditMode}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Type</label>
                    {isEditMode ? (
                      <select
                        name="item_type"
                        value={formData.item_type}
                        onChange={handleChange}
                        className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                      >
                        <option value="">Select Type</option>
                        <option value="part">Part</option>
                        <option value="tool">Tool</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        name="item_type"
                        value={formData.item_type}
                        onChange={handleChange}
                        className="w-full p-2 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-300 transition-colors"
                        readOnly
                      />
                    )}
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Life Cycle</label>
                    <input
                      type="number"
                      name="item_life_cycle"
                      value={formData.item_life_cycle}
                      onChange={handleChange}
                      className={`w-full p-2 border dark:border-gray-600 rounded transition-colors ${isEditMode ? "bg-white dark:bg-gray-700 dark:text-white" : "bg-gray-100 dark:bg-gray-700 dark:text-gray-300"}`}
                      readOnly={!isEditMode}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Current Quantity</label>
                    <input
                      type="number"
                      name="item_current_quantity"
                      value={formData.item_current_quantity}
                      readOnly
                      className="w-full p-2 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-300 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">Unit Price</label>
                    <input
                      type="text"
                      name="item_unit_price"
                      value={formData.item_unit_price}
                      onChange={handleChange}
                      className={`w-full p-2 border dark:border-gray-600 rounded transition-colors ${isEditMode ? "bg-white dark:bg-gray-700 dark:text-white" : "bg-gray-100 dark:bg-gray-700 dark:text-gray-300"}`}
                      placeholder="e.g., 12.50"
                      readOnly={!isEditMode}
                    />
                  </div>
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                      Item Image
                    </label>
                    
                    {/* Current Image Display */}
                    {formData.item_image_url && !imagePreview && (
                      <div className="mb-3">
                        <img
                          src={getImageUrl(formData.item_image_url)}
                          alt="Current item"
                          className="w-32 h-32 object-cover rounded border dark:border-gray-600"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* File Upload (only in edit mode) */}
                    {isEditMode && (
                      <>
                        <div className="mb-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors text-sm"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Upload a new image file (JPG, PNG, GIF, WebP)
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
                            <button
                              type="button"
                              onClick={handleImageUpload}
                              disabled={uploading}
                              className="mt-2 px-4 py-1 bg-blue-600 dark:bg-blue-700 text-white text-sm rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
                            >
                              {uploading ? "Uploading..." : "Upload Image"}
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Manual URL Input (Alternative, only in edit mode) */}
                    {isEditMode && (
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
                    )}

                    {/* Read-only display when not in edit mode */}
                    {!isEditMode && (
                      <input
                        type="text"
                        name="item_image_url"
                        value={formData.item_image_url || "No image"}
                        readOnly
                        className="w-full p-2 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-300 transition-colors"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* RESTOCK SECTION - separated visually */}
              <div className="border-t dark:border-gray-600 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Restock Quantity</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
                      Adding Quantity
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">(required for restock)</span>
                    </label>
                    <input
                      type="number"
                      name="quantity_to_add"
                      value={formData.quantity_to_add}
                      onChange={handleChange}
                      className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded transition-colors"
                      placeholder="Enter quantity to add"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
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
              </div>
            </>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            className="px-8 py-2 bg-gray-200 dark:bg-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 shadow transition-colors font-medium"
            onClick={() => {
              let backUrl = `/dashboard/restock/items?project=${encodeURIComponent(project || "")}`;
              if (test_area) {
                backUrl += `&test_area=${encodeURIComponent(test_area)}`;
              }
              navigate(backUrl);
            }}
          >
            Back
          </button>

          {/* Save Changes - only visible in edit mode, no quantity required */}
          {isEditMode && (
            <button
              className="px-8 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 shadow transition-colors font-medium"
              onClick={handleSaveChanges}
            >
              Save Changes
            </button>
          )}

          <button
            className="px-8 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 shadow transition-colors font-medium"
            onClick={handleRestock}
          >
            Submit Restock
          </button>
        </div>
      </div>

    </div>
  );
}

