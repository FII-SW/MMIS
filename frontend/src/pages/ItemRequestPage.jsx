import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import API from "../api";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";

export default function ItemRequestPage() {
  const { item_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Read project & test_area from URL at the top
  const queryParams = new URLSearchParams(location.search);
  const project = queryParams.get("project");
  const test_area = queryParams.get("test_area");

  // Hooks MUST be here
  const [item, setItem] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [fixture, setFixture] = useState("");
  const [quantity, setQuantity] = useState("");
  const [alternativeItems, setAlternativeItems] = useState([]);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [showFixtureDropdown, setShowFixtureDropdown] = useState(false);
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

  // Load item details
  useEffect(() => {
    API.get(`/inventory/${item_id}`)
      .then((res) => {
        setItem(res.data);
        // If item is out of stock, automatically check for alternatives
        if (res.data && res.data.item_current_quantity === 0) {
          loadAlternativeItems(item_id);
        }
      })
      .catch((err) => console.error("Error loading item:", err));
  }, [item_id]);

  // Load alternative items
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

  // Projects that don't require fixtures
  const skipFixtureProjects = ["Hi-Lo", "Flying Probe", "Development"];
  const requiresFixture = project && !skipFixtureProjects.includes(project);

  // Load fixtures — Only for projects that require fixtures
  useEffect(() => {
    if (!requiresFixture) {
      setFixtures([]);
      return;
    }
    API.get(`/fixtures/filter?project=${project || ""}&test_area=${test_area || ""}`)
      .then((res) => setFixtures(res.data))
      .catch((err) => console.error("Error loading fixtures:", err));
  }, [project, test_area, requiresFixture]);

  const submitRequest = async () => {
    // Validation: fixture required only for projects that need it
    if (requiresFixture && !fixture) {
      alert("Select fixture");
      return;
    }
    if (!quantity) {
      alert("Enter quantity");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const payload = JSON.parse(atob(token.split(".")[1]));

      const requestData = {
        employee_id: payload.employee_id,
        item_id,
        quantity: Number(quantity),
        test_area: test_area || null,
        project_name: project,
        transaction_type: "Request",
        fixture_id: (requiresFixture && fixture) ? Number(fixture) : null,
      };

      const response = await API.post("/inventory/request", requestData);

      // Check if transfer was used
      if (response.data && response.data.transfer_used) {
        alert(`Request submitted! ${response.data.transferred_from_other_projects} units were automatically transferred from other projects.`);
      } else {
      alert("Request submitted!");
      }
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.detail || "Failed to submit request";
      alert(errorMessage);
      
      // If request failed due to insufficient stock, show alternatives if not already shown
      if (err.response?.status === 400 && !showAlternatives) {
        loadAlternativeItems(item_id);
    }
    }
  };

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

  // Filter fixtures based on search
  const filteredFixtures = fixtures.filter((fx) =>
    fx.fixture_name.toLowerCase().includes(fixtureSearch.toLowerCase())
  );

  // Get selected fixture name
  const selectedFixtureName = fixtures.find(fx => String(fx.fixture_id) === String(fixture))?.fixture_name || "";

  const handleBack = () => {
    if (!project) {
      navigate("/dashboard/request");
      return;
    }
    let url = `/dashboard/request/search?project=${encodeURIComponent(project)}`;
    if (test_area) {
      url += `&test_area=${encodeURIComponent(test_area)}`;
    }
    navigate(url);
  };

  // MUST COME AFTER HOOKS
  if (!item) {
    return (
      <div className="min-h-screen bg-transparent transition-colors">
        <Header />
        <PageHeaderWithBack title="Request Item" onBack={handleBack} />
        <h2 className="text-center mt-10 text-gray-500 dark:text-gray-400">Loading...</h2>
      </div>
    );
  }

  return (
    <div className="h-screen bg-transparent transition-colors flex flex-col overflow-hidden">
      <Header />

      <PageHeaderWithBack title="Request Item" onBack={handleBack} />

      {/* Main content - fills remaining screen */}
      <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-6 py-3 overflow-auto">

        {/* TOP SECTION: Image + Details */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow-md p-5 mb-3 transition-colors">
          <div className="flex gap-8">
            {/* Item Image - Large */}
            <div className="flex-shrink-0 relative">
              {getImageUrl(item.item_image_url) ? (
                <div className="relative group">
                  <img 
                    src={getImageUrl(item.item_image_url)} 
                    alt={item.item_name}
                    className="w-64 h-52 object-contain rounded-xl border-2 border-gray-200 dark:border-gray-600 shadow bg-white dark:bg-gray-700 p-3 cursor-pointer hover:shadow-lg transition-all duration-200"
                    onClick={() => setShowImageModal(true)}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  {/* Zoom indicator */}
                  <div className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  </div>
                </div>
              ) : null}
              <div 
                className="w-64 h-52 bg-gray-100 dark:bg-gray-600 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-500 text-base"
                style={{ display: getImageUrl(item.item_image_url) ? 'none' : 'flex' }}
              >
                IMAGE
              </div>
            </div>
            
            {/* Item Details */}
            <div className="flex-1 flex flex-col justify-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">{item.item_name}</h2>
              <div className="space-y-2 text-base">
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Part Number:</span> {item.item_part_number || "N/A"}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Description:</span> {item.item_description || "N/A"}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Manufacturer:</span> {item.item_manufacturer || "N/A"}
                </p>
                <p className={`font-bold text-lg mt-2 ${
                  item.item_current_quantity === 0 
                    ? "text-red-600 dark:text-red-400" 
                    : "text-green-600 dark:text-green-400"
                }`}>
                  Current Quantity: {item.item_current_quantity}
                  {item.item_current_quantity === 0 && <span className="ml-2 text-sm font-normal">(Out of Stock)</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ALTERNATIVE ITEMS CARD - Show when item is out of stock */}
        {showAlternatives && item && item.item_current_quantity === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl shadow p-4 mb-3 transition-colors">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-bold text-yellow-800 dark:text-yellow-200">
                Out of Stock: Same item available in other projects
              </h3>
              <button
                onClick={() => setShowAlternatives(false)}
                className="text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 text-lg font-bold"
              >
                x
              </button>
            </div>
            
            {loadingAlternatives ? (
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">Loading alternatives...</p>
            ) : alternativeItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-yellow-100 dark:bg-yellow-900/40 border-b dark:border-yellow-800">
                      <th className="p-2 text-left font-semibold text-yellow-800 dark:text-yellow-200">Project</th>
                      <th className="p-2 text-left font-semibold text-yellow-800 dark:text-yellow-200">Test Area</th>
                      <th className="p-2 text-left font-semibold text-yellow-800 dark:text-yellow-200">Available Qty</th>
                      <th className="p-2 text-left font-semibold text-yellow-800 dark:text-yellow-200">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alternativeItems.map((altItem) => (
                      <tr key={altItem.item_id} className="border-b dark:border-yellow-800">
                        <td className="p-2 text-yellow-800 dark:text-yellow-200">{altItem.project_name}</td>
                        <td className="p-2 text-yellow-800 dark:text-yellow-200">{altItem.test_area || "N/A"}</td>
                        <td className="p-2 font-semibold text-green-600 dark:text-green-400">
                          {altItem.item_current_quantity} {altItem.item_unit || ""}
                        </td>
                        <td className="p-2">
                          {isAdmin ? (
                            <button
                              onClick={() => navigate(`/dashboard/transfer?source_item_id=${altItem.item_id}&dest_item_id=${item.item_id}`)}
                              className="px-3 py-1.5 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 text-xs transition-colors"
                            >
                              Transfer
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
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">No alternatives found.</p>
            )}
          </div>
        )}

        {/* FORM FIELDS - Stacked vertically as per drawing */}
        <div className="space-y-3">
          {/* Fixture with search box & dropdown */}
          {requiresFixture && (
            <div className="relative">
              <div className="relative">
                <input
                  type="text"
                  className="w-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white p-3 rounded-lg text-base transition-all pr-10 hover:border-blue-300"
                  placeholder="Search & select fixture..."
                  value={showFixtureDropdown ? fixtureSearch : selectedFixtureName || fixtureSearch}
                  onChange={(e) => {
                    setFixtureSearch(e.target.value);
                    setShowFixtureDropdown(true);
                    if (!e.target.value) setFixture("");
                  }}
                  onFocus={() => setShowFixtureDropdown(true)}
                  onBlur={() => setTimeout(() => setShowFixtureDropdown(false), 200)}
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {showFixtureDropdown && (
                <div className="dropdown-menu absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredFixtures.length > 0 ? (
                    filteredFixtures.map((fx) => (
                      <div
                        key={fx.fixture_id}
                        className={`p-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-600 text-sm ${
                          String(fx.fixture_id) === String(fixture) ? "bg-blue-100 dark:bg-gray-600 font-semibold" : ""
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFixture(String(fx.fixture_id));
                          setFixtureSearch(fx.fixture_name);
                          setShowFixtureDropdown(false);
                        }}
                      >
                        {fx.fixture_name}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-gray-400 text-sm">No fixtures found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quantity */}
          <input
            type="number"
            min="1"
            className="w-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white p-3 rounded-lg text-base transition-all hover:border-blue-300"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantity"
          />

          {/* Remarks */}
          <input
            type="text"
            className="w-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white p-3 rounded-lg text-base transition-all hover:border-blue-300"
            placeholder="Remarks (Optional)"
          />
        </div>

        {/* BUTTONS */}
        <div className="flex justify-center gap-5 mt-4 pb-2">
          <button
            className="px-10 py-2.5 bg-blue-100 dark:bg-gray-700 text-blue-800 dark:text-gray-200 rounded-lg hover:bg-blue-200 dark:hover:bg-gray-600 text-base font-medium border border-blue-200 dark:border-gray-600 transition-colors"
            onClick={handleBack}
          >
            Back
          </button>
          <button
            className="px-10 py-2.5 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 text-base font-medium shadow transition-colors"
            onClick={submitRequest}
          >
            Submit Request
          </button>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && getImageUrl(item.item_image_url) && (
        <div 
          className="fixed inset-0 bg-black/80 dark:bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors z-10 shadow-lg"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img 
              src={getImageUrl(item.item_image_url)} 
              alt={item.item_name}
              className="w-full h-full object-contain rounded-lg bg-white dark:bg-gray-800 p-4"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center mt-4 text-lg font-semibold">{item.item_name}</p>
          </div>
        </div>
      )}

    </div>
  );
}
