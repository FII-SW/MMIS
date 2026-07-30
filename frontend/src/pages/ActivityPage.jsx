// src/pages/ActivityPage.jsx
import { useEffect, useState, useRef } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { getProjects } from "../utils/projects";

export default function ActivityPage() {
  const TRANSACTIONS_PER_PAGE = 20;
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTestArea, setSelectedTestArea] = useState("");
  
  // Dropdown states
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showTestAreaDropdown, setShowTestAreaDropdown] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [testAreaSearch, setTestAreaSearch] = useState("");
  const projectRef = useRef(null);
  const testAreaRef = useRef(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    API.get(`/transactions/all`)
      .then((res) => {
        setHistory(res.data);
        setFilteredHistory(res.data);
      })
      .catch((err) => {
        console.error("Error loading activity history:", err);
        setLoadError("Failed to load activity history. Please try again.");
        setHistory([]);
        setFilteredHistory([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Predefined test areas
  const testAreas = [
    "ICT_Mobo",
    "BSI_Mobo",
    "FBT_Mobo",
    "ICT_Agora",
    "FBT_Agora",
    "TOOLS",
    "ORT",
    "L10_Racks"
  ];

  // Get unique projects from history and merge with custom projects from localStorage
  const uniqueProjectsFromData = [...new Set(history.map(h => h.project_name).filter(Boolean))];
  const customProjects = getProjects();
  const allProjects = [...new Set([...customProjects, ...uniqueProjectsFromData])].sort();
  const uniqueProjects = allProjects;

  // Filtered options for dropdowns
  const filteredProjects = uniqueProjects.filter(project =>
    project.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const filteredTestAreas = testAreas.filter(area =>
    area.toLowerCase().includes(testAreaSearch.toLowerCase())
  );

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
    if (selectedProject) {
      setProjectSearch(selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedTestArea) {
      setTestAreaSearch(selectedTestArea);
    }
  }, [selectedTestArea]);

  // Filter by transaction type, project, and test area
  useEffect(() => {
    let filtered = history;

    // Filter by transaction type
    if (selectedType !== "all") {
      filtered = filtered.filter((row) => row.transaction_type?.toLowerCase() === selectedType.toLowerCase());
    }

    // Filter by project
    if (selectedProject) {
      filtered = filtered.filter((row) => row.project_name === selectedProject);
    }

    // Filter by test area
    if (selectedTestArea) {
      filtered = filtered.filter((row) => row.test_area === selectedTestArea);
    }

    setFilteredHistory(filtered);
  }, [selectedType, selectedProject, selectedTestArea, history]);

  // Reset to page 1 whenever the filter result set changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType, selectedProject, selectedTestArea, history]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / TRANSACTIONS_PER_PAGE));
  const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
  const paginatedHistory = filteredHistory.slice(startIndex, startIndex + TRANSACTIONS_PER_PAGE);

  const getVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage === 1) {
      return [1, "...", totalPages];
    }

    if (currentPage === totalPages) {
      return [1, "...", totalPages];
    }

    return [1, "...", currentPage, "...", totalPages];
  };

  const formatQuantity = (type, qty) => {
    if (type?.toLowerCase() === "request") {
      return <span className="text-red-600 font-semibold">-{qty}</span>;
    }
    if (type?.toLowerCase() === "return") {
      return <span className="text-green-600 font-semibold">+{qty}</span>;
    }
    if (type?.toLowerCase() === "restock") {
      return <span className="text-blue-600 font-semibold">+{qty}</span>;
    }
    return <span className="text-blue-600 font-semibold">+{qty}</span>;
  };

  const getTransactionTypeBadge = (type) => {
    const typeLower = type?.toLowerCase() || "";
    if (typeLower === "request") {
      return <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold">REQUEST</span>;
    }
    if (typeLower === "return") {
      return <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">RETURN</span>;
    }
    if (typeLower === "restock") {
      return <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">RESTOCK</span>;
    }
    return <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-semibold">{type?.toUpperCase() || "N/A"}</span>;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const year = date.getFullYear().toString().slice(-2);
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${month}/${day}/${year} ${displayHours}:${minutes} ${ampm}`;
  };

  // Calculate statistics
  const stats = {
    total: history.length,
    requests: history.filter((h) => h.transaction_type?.toLowerCase() === "request").length,
    returns: history.filter((h) => h.transaction_type?.toLowerCase() === "return").length,
    restocks: history.filter((h) => h.transaction_type?.toLowerCase() === "restock").length,
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Recent Activity History" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto w-full max-w-[min(100%,1600px)] px-4 sm:px-6 lg:px-8">
        {loadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/30 dark:bg-red-900/20 dark:text-red-300">
            {loadError}
          </div>
        )}
        {/* STATISTICS CARDS */}
        {!loading && history.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500 transition-colors">
              <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Transactions</div>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-1">{stats.total}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500 transition-colors">
              <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Requests</div>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-1">{stats.requests}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500 transition-colors">
              <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Returns</div>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-1">{stats.returns}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500 transition-colors">
              <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Restocks</div>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-1">{stats.restocks}</div>
            </div>
          </div>
        )}

        {/* FILTER SECTION */}
        {!loading && history.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 transition-colors">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Transaction Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Type</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedType("all")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      selectedType === "all"
                        ? "bg-blue-600 dark:bg-blue-700 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedType("request")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      selectedType === "request"
                        ? "bg-red-600 dark:bg-red-700 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    Requests
                  </button>
                  <button
                    onClick={() => setSelectedType("return")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      selectedType === "return"
                        ? "bg-green-600 dark:bg-green-700 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    Returns
                  </button>
                  <button
                    onClick={() => setSelectedType("restock")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      selectedType === "restock"
                        ? "bg-blue-600 dark:bg-blue-700 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    Restocks
                  </button>
                </div>
              </div>

              {/* Project Name Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Name</label>
                <div className="relative" ref={projectRef}>
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => {
                      setProjectSearch(e.target.value);
                      setShowProjectDropdown(true);
                    }}
                    onFocus={() => setShowProjectDropdown(true)}
                    placeholder="Search or select project"
                    className="w-full p-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm pr-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {selectedProject && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject("");
                          setProjectSearch("");
                          setShowProjectDropdown(false);
                        }}
                        className="text-gray-400 hover:text-red-600"
                        title="Clear selection"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                      className="text-gray-600 hover:text-black"
                    >
                      <svg
                        className={`w-5 h-5 transform transition-transform duration-200 ${
                          showProjectDropdown ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {showProjectDropdown && (
                    <div className="dropdown-menu absolute left-0 right-0 mt-1 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 transition-colors">
                      {filteredProjects.length === 0 ? (
                        <div className="p-3 text-gray-500 dark:text-gray-400">No matches found</div>
                      ) : (
                        filteredProjects.map((project) => (
                          <div
                            key={project}
                            onClick={() => {
                              setSelectedProject(project);
                              setProjectSearch(project);
                              setShowProjectDropdown(false);
                            }}
                            className={`p-3 border-b dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer text-gray-800 dark:text-gray-200 ${
                              selectedProject === project ? "bg-blue-100 dark:bg-gray-600" : ""
                            }`}
                          >
                            {project}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Test Area Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Test Area</label>
                <div className="relative" ref={testAreaRef}>
                  <input
                    type="text"
                    value={testAreaSearch}
                    onChange={(e) => {
                      setTestAreaSearch(e.target.value);
                      setShowTestAreaDropdown(true);
                    }}
                    onFocus={() => setShowTestAreaDropdown(true)}
                    placeholder="Search or select test area"
                    className="w-full p-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg shadow-sm pr-20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {selectedTestArea && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTestArea("");
                          setTestAreaSearch("");
                          setShowTestAreaDropdown(false);
                        }}
                        className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                        title="Clear selection"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowTestAreaDropdown(!showTestAreaDropdown)}
                      className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white"
                    >
                      <svg
                        className={`w-5 h-5 transform transition-transform duration-200 ${
                          showTestAreaDropdown ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {showTestAreaDropdown && (
                    <div className="dropdown-menu absolute left-0 right-0 mt-1 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 transition-colors">
                      {filteredTestAreas.length === 0 ? (
                        <div className="p-3 text-gray-500 dark:text-gray-400">No matches found</div>
                      ) : (
                        filteredTestAreas.map((area) => (
                          <div
                            key={area}
                            onClick={() => {
                              setSelectedTestArea(area);
                              setTestAreaSearch(area);
                              setShowTestAreaDropdown(false);
                            }}
                            className={`p-3 border-b dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-600 cursor-pointer text-gray-800 dark:text-gray-200 ${
                              selectedTestArea === area ? "bg-blue-100 dark:bg-gray-600" : ""
                            }`}
                          >
                            {area}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Clear All Filters Button */}
            {(selectedType !== "all" || selectedProject || selectedTestArea) && (
              <button
                onClick={() => {
                  setSelectedType("all");
                  setSelectedProject("");
                  setSelectedTestArea("");
                  setProjectSearch("");
                  setTestAreaSearch("");
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* MAIN TABLE */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden transition-colors">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <p className="text-gray-500 dark:text-gray-400 mt-4">Loading activity history...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                {history.length === 0 ? "No activity yet." : `No ${selectedType === "all" ? "" : selectedType} transactions found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600">
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Employee</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Part Number</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Description</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Project</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Test Area</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Fixture</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Quantity</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>

                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedHistory.map((row, index) => (
                    <tr
                      key={row.transaction_id}
                      className={`hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                        index % 2 === 0 ? "bg-white dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-800/50"
                      }`}
                    >
                      <td className="p-4 whitespace-nowrap">{getTransactionTypeBadge(row.transaction_type)}</td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-200">{row.employee_name}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                          {row.item_name || row.fixture_name || "N/A"}
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">{row.item_part_number || "N/A"}</div>
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="text-sm text-gray-700 dark:text-gray-300 truncate" title={row.item_description}>
                          {row.item_description || "N/A"}
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">{row.project_name || "N/A"}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">{row.test_area || "N/A"}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {row.transaction_type?.toLowerCase() === "restock" ? "N/A" : (row.fixture_name || "N/A")}
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-sm font-semibold">{formatQuantity(row.transaction_type, row.quantity_used)}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 dark:text-gray-300">{formatDate(row.created_at)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAGINATION (bottom of table card) */}
        {!loading && filteredHistory.length > TRANSACTIONS_PER_PAGE && (
          <div className="sticky bottom-0 z-10 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
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
                  <span
                    key={`ellipsis-${index}`}
                    className="min-w-9 px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400 text-center"
                  >
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

        {/* RESULTS COUNT */}
        {!loading && filteredHistory.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 text-center">
            Showing {startIndex + 1}-{Math.min(startIndex + TRANSACTIONS_PER_PAGE, filteredHistory.length)} of {filteredHistory.length} filtered transaction{filteredHistory.length !== 1 ? "s" : ""}
          </div>
        )}

      </div>
    </div>
  );
}