import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import ProjectSelector from "../components/ProjectSelector";
import SearchableSelect from "../components/SearchableSelect";
import { getProjects } from "../utils/projects";

export default function LowStockReportPage() {
  const ROWS_PER_PAGE = 20;
  const [lowStockItems, setLowStockItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [alternativeItems, setAlternativeItems] = useState([]);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [itemsWithAlternatives, setItemsWithAlternatives] = useState({}); // item_id -> alternatives count
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTestArea, setSelectedTestArea] = useState("");
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setIsAdmin(payload.role === "admin");
      }
    } catch {
      setIsAdmin(false);
    }
  }, []);

  // Get projects from shared utility
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

  const testAreas = [
    "ICT_Mobo", "BSI_Mobo", "FBT_Mobo", "ICT_Agora", "FBT_Agora", "TOOLS", "ORT", "L10_Racks"
  ];

  // Load low stock items
  useEffect(() => {
    setLoading(true);
    let url = "/alerts/low-stock";
    const params = [];
    if (selectedProject) params.push(`project=${encodeURIComponent(selectedProject)}`);
    if (selectedTestArea) params.push(`test_area=${encodeURIComponent(selectedTestArea)}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    API.get(url)
      .then((res) => {
        setLowStockItems(res.data);
        setFilteredItems(res.data);
        // Automatically check for alternatives for items with quantity = 0
        checkAlternativesForOutOfStockItems(res.data);
      })
      .catch((err) => {
        console.error("Error loading low stock items:", err);
        setLowStockItems([]);
        setFilteredItems([]);
      })
      .finally(() => setLoading(false));
  }, [selectedProject, selectedTestArea]);

  // Check for alternatives for items that are out of stock (quantity = 0)
  const checkAlternativesForOutOfStockItems = async (items) => {
    const outOfStockItems = items.filter(item => item.item_current_quantity === 0);
    const alternativesMap = {};
    
    // Check alternatives for each out-of-stock item
    const promises = outOfStockItems.map(async (item) => {
      try {
        const res = await API.get(`/inventory/${item.item_id}/alternatives`);
        if (res.data && res.data.length > 0) {
          alternativesMap[item.item_id] = res.data.length;
        }
      } catch (err) {
        console.error(`Error checking alternatives for item ${item.item_id}:`, err);
      }
    });
    
    await Promise.all(promises);
    setItemsWithAlternatives(alternativesMap);
  };

  // Filter items client-side as well (for additional filtering)
  useEffect(() => {
    let filtered = lowStockItems;

    if (selectedProject) {
      filtered = filtered.filter(item => item.project_name === selectedProject);
    }

    if (selectedTestArea) {
      filtered = filtered.filter(item => item.test_area === selectedTestArea);
    }

    setFilteredItems(filtered);
  }, [lowStockItems, selectedProject, selectedTestArea]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProject, selectedTestArea, lowStockItems]);

  // Load alternative items when an item is selected
  useEffect(() => {
    if (selectedItemId) {
      const item = filteredItems.find(i => i.item_id === selectedItemId);
      setSelectedItem(item);
      loadAlternativeItems(selectedItemId);
    } else {
      setSelectedItem(null);
      setAlternativeItems([]);
      setShowAlternatives(false);
    }
  }, [selectedItemId, filteredItems]);

  // Auto-show alternatives for out-of-stock items when they're selected
  useEffect(() => {
    if (selectedItem && selectedItem.item_current_quantity === 0 && alternativeItems.length > 0) {
      setShowAlternatives(true);
    }
  }, [selectedItem, alternativeItems]);

  const loadAlternativeItems = async (itemId) => {
    setLoadingAlternatives(true);
    try {
      const res = await API.get(`/inventory/${itemId}/alternatives`);
      setAlternativeItems(res.data || []);
      setShowAlternatives(res.data && res.data.length > 0);
    } catch (err) {
      console.error("Error loading alternative items:", err);
      setAlternativeItems([]);
      setShowAlternatives(false);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ROWS_PER_PAGE));
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + ROWS_PER_PAGE);

  const getVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    if (currentPage === 1 || currentPage === totalPages) {
      return [1, "...", totalPages];
    }
    return [1, "...", currentPage, "...", totalPages];
  };

  const downloadCSV = () => {
    if (filteredItems.length === 0) {
      alert("No data to download");
      return;
    }

    // CSV Headers
    const headers = [
      "Item ID",
      "Item Name",
      "Part Number",
      "Description",
      "Current Quantity",
      "Minimum Count",
      "Unit",
      "Manufacturer",
      "Type",
      "Test Area",
      "Project Name",
      "Life Cycle"
    ];

    // CSV Rows
    const rows = filteredItems.map((item) => [
      item.item_id || "",
      item.item_name || "",
      item.item_part_number || "",
      item.item_description || "",
      item.item_current_quantity || 0,
      item.item_min_count || 0,
      item.item_unit || "",
      item.item_manufacturer || "",
      item.item_type || "",
      item.test_area || "",
      item.project_name || "",
      item.item_life_cycle || ""
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `low_stock_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">

      <Header />

      <PageHeaderWithBack title="Low Stock Report" onBack={() => navigate("/dashboard/reports")} />

      {/* FILTERS */}
      <div className="max-w-7xl mx-auto px-10 mb-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 flex gap-6 items-end transition-colors">
          <div className="flex-1">
            <label className="block mb-2 text-base font-semibold text-gray-700 dark:text-gray-300">Project Name</label>
            <ProjectSelector
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              placeholder="Search or select project…"
              className="w-full p-3 pr-8 text-base"
            />
          </div>

          <div className="flex-1">
            <label htmlFor="low-stock-filter-test-area" className="block mb-2 text-base font-semibold text-gray-700 dark:text-gray-300">
              Test Area
            </label>
            <SearchableSelect
              id="low-stock-filter-test-area"
              options={testAreas}
              value={selectedTestArea}
              onChange={setSelectedTestArea}
              placeholder="Search or select test area…"
              inputMode="commit"
              size="md"
            />
          </div>

          {/* Clear Filters Button */}
          {(selectedProject || selectedTestArea) && (
            <button
              onClick={() => {
                setSelectedProject("");
                setSelectedTestArea("");
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 dark:text-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 shadow transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY AND DOWNLOAD BUTTON */}
      <div className="max-w-7xl mx-auto px-10 mb-6 flex justify-between items-center">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          {loading ? "Loading..." : `Total Items: ${filteredItems.length}`}
        </div>
        <button
          onClick={downloadCSV}
          disabled={loading || filteredItems.length === 0}
          className="px-8 py-3 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 shadow disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-base font-semibold transition-colors"
        >
          Download CSV
        </button>
      </div>

      {/* LOW STOCK TABLE */}
      <div className="max-w-7xl mx-auto px-10 mb-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 transition-colors">
          {loading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No low stock items found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">ID</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Description</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Current Qty</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Min Count</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Unit</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Manufacturer</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Test Area</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Project</th>
                    <th className="p-4 text-left font-semibold text-gray-700 dark:text-gray-300">Alternatives</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item) => (
                    <tr 
                      key={item.item_id} 
                      onClick={() => setSelectedItemId(item.item_id)}
                      className={`border-b dark:border-gray-700 cursor-pointer transition-colors ${
                        selectedItemId === item.item_id 
                          ? "bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/40" 
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <td className="p-4 text-gray-800 dark:text-gray-200">{item.item_id}</td>
                      <td className={`p-4 font-medium text-gray-800 dark:text-gray-200 ${selectedItemId === item.item_id ? "text-blue-700 dark:text-blue-400 font-bold" : ""}`}>{item.item_name}</td>
                      <td className="p-4 text-gray-800 dark:text-gray-200">{item.item_part_number || "N/A"}</td>
                      <td className="p-4 max-w-xs truncate text-gray-800 dark:text-gray-200">{item.item_description || "N/A"}</td>
                      <td className="p-4 text-red-600 dark:text-red-400 font-semibold">{item.item_current_quantity}</td>
                      <td className="p-4 text-gray-800 dark:text-gray-200">{item.item_min_count}</td>
                      <td className="p-4 text-gray-800 dark:text-gray-200">{item.item_unit || "N/A"}</td>
                      <td className="p-4 text-gray-800 dark:text-gray-200">{item.item_manufacturer || "N/A"}</td>
                      <td className="p-4 text-gray-800 dark:text-gray-200">{item.test_area || "N/A"}</td>
                      <td className="p-4 text-gray-800 dark:text-gray-200">{item.project_name || "N/A"}</td>
                      <td className="p-4 text-gray-800 dark:text-gray-200">
                        {itemsWithAlternatives[item.item_id] > 0 ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            ✓ {itemsWithAlternatives[item.item_id]} available
                          </span>
                        ) : item.item_current_quantity === 0 ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                            Out of stock
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredItems.length > ROWS_PER_PAGE && (
            <div className="sticky bottom-0 z-10 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 mt-4">
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === 1
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  Previous
                </button>

                {getVisiblePages().map((item, index) =>
                  item === "..." ? (
                    <span key={`ellipsis-${index}`} className="min-w-9 px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400 text-center">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`min-w-9 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === item
                          ? "bg-blue-600 dark:bg-blue-700 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === totalPages
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ALTERNATIVE ITEMS CARD - Show automatically for out of stock items or when clicked */}
      {(showAlternatives || (selectedItem && selectedItem.item_current_quantity === 0 && itemsWithAlternatives[selectedItem.item_id] > 0)) && selectedItem && (
        <div className="max-w-7xl mx-auto px-10 mb-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 shadow transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                {selectedItem.item_current_quantity === 0 ? (
                  <>⚠️ Out of Stock: Same item available in other projects</>
                ) : (
                  <>⚠️ Low Stock Alert: Same item available in other projects</>
                )}
              </h3>
              <button
                onClick={() => {
                  setShowAlternatives(false);
                  setSelectedItemId(null);
                }}
                className="text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 text-xl font-bold"
              >
                ✕
              </button>
            </div>
            
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
              <strong>{selectedItem.item_name}</strong> {selectedItem.item_current_quantity === 0 ? 'is out of stock' : 'is running low'} in <strong>{selectedItem.project_name}</strong>. 
              The same item is available in other projects:
            </p>

            {loadingAlternatives ? (
              <p className="text-yellow-700 dark:text-yellow-300">Loading alternatives...</p>
            ) : alternativeItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-yellow-100 dark:bg-yellow-900/40 border-b dark:border-yellow-800">
                      <th className="p-3 text-left font-semibold text-yellow-800 dark:text-yellow-200">Project</th>
                      <th className="p-3 text-left font-semibold text-yellow-800 dark:text-yellow-200">Test Area</th>
                      <th className="p-3 text-left font-semibold text-yellow-800 dark:text-yellow-200">Available Qty</th>
                      <th className="p-3 text-left font-semibold text-yellow-800 dark:text-yellow-200">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alternativeItems.map((altItem) => (
                      <tr key={altItem.item_id} className="border-b dark:border-yellow-800">
                        <td className="p-3 text-yellow-800 dark:text-yellow-200">{altItem.project_name}</td>
                        <td className="p-3 text-yellow-800 dark:text-yellow-200">{altItem.test_area || "N/A"}</td>
                        <td className="p-3 font-semibold text-green-600 dark:text-green-400">
                          {altItem.item_current_quantity} {altItem.item_unit || ""}
                        </td>
                        <td className="p-3">
                          {isAdmin ? (
                            <button
                              onClick={() => navigate(`/dashboard/transfer?source_item_id=${altItem.item_id}&dest_item_id=${selectedItem.item_id}`)}
                              className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 text-sm transition-colors"
                            >
                              Transfer to {selectedItem.project_name}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">Admin only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-yellow-700 dark:text-yellow-300">No alternatives found.</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

