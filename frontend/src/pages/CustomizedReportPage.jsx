import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import SearchableSelect from "../components/SearchableSelect";
import { getProjects } from "../utils/projects";

export default function CustomizedReportPage() {
  const ROWS_PER_PAGE = 20;
  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState(null);
  const navigate = useNavigate();

  // Filter states
  const [testArea, setTestArea] = useState("");
  const [projectName, setProjectName] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Options
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

  const generateReport = () => {
    setLoading(true);
    setCurrentPage(1);
    
    // Build query parameters
    const params = new URLSearchParams();
    if (testArea) params.append("test_area", testArea);
    if (projectName) params.append("project", projectName);
    if (transactionType) params.append("transaction_type", transactionType);
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const url = `/transactions/all${params.toString() ? "?" + params.toString() : ""}`;
    
    API.get(url)
      .then((res) => {
        setTransactions(res.data);
      })
      .catch((err) => {
        console.error("Error generating report:", err);
        alert("Failed to generate report");
        setTransactions([]);
      })
      .finally(() => setLoading(false));
  };

  const downloadCSV = () => {
    if (transactions.length === 0) {
      alert("No data to download. Please generate a report first.");
      return;
    }

    // CSV Headers
    const headers = [
      "Transaction ID",
      "Date & Time",
      "Transaction Type",
      "Employee Name",
      "Item Name",
      "Part Number",
      "Description",
      "Quantity",
      "Fixture",
      "Test Area",
      "Project Name"
    ];

    // CSV Rows
    const rows = transactions.map((tx) => [
      tx.transaction_id || "",
      new Date(tx.created_at).toLocaleString(),
      tx.transaction_type || "",
      tx.employee_name || "",
      tx.item_name || "",
      tx.item_part_number || "",
      tx.item_description || "",
      tx.quantity_used || 0,
      tx.fixture_name || "",
      tx.test_area || "",
      tx.project_name || ""
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `customized_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.max(1, Math.ceil(transactions.length / ROWS_PER_PAGE));
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const paginatedTransactions = transactions.slice(startIndex, startIndex + ROWS_PER_PAGE);

  const getVisiblePages = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    if (currentPage === 1 || currentPage === totalPages) {
      return [1, "...", totalPages];
    }
    return [1, "...", currentPage, "...", totalPages];
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Customized Report" onBack={() => navigate("/dashboard/reports")} />

      {/* FILTER FORM */}
      <div className="max-w-4xl mx-auto px-8 mb-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6 transition-colors">
          <div className="space-y-4">
            <div>
              <label htmlFor="custom-report-test-area" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Test Area:
              </label>
              <SearchableSelect
                id="custom-report-test-area"
                options={testAreas}
                value={testArea}
                onChange={setTestArea}
                placeholder="Search or select test area…"
                inputMode="commit"
                size="sm"
              />
            </div>
            <div>
              <label htmlFor="custom-report-project" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Project Name:
              </label>
              <SearchableSelect
                id="custom-report-project"
                options={projects}
                value={projectName}
                onChange={setProjectName}
                placeholder="Search or select project…"
                inputMode="commit"
                size="sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Transaction Type:</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded shadow-sm transition-colors"
              >
                <option value="">All Types</option>
                <option value="request">Request</option>
                <option value="return">Return</option>
                <option value="restock">Restock</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Start Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded shadow-sm transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">End Date:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded shadow-sm transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <button
              type="button"
              onClick={generateReport}
              disabled={loading}
              className="px-8 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 shadow disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors"
            >
              {loading ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </div>

      {/* RESULTS TABLE */}
      {transactions.length > 0 && (
        <div className="max-w-6xl mx-auto px-8 mb-8">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Report Results ({transactions.length} transactions)</h2>
              <button
                onClick={downloadCSV}
                className="px-6 py-2 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 shadow transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Date</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Type</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Employee</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Item</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Part Number</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Quantity</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Fixture</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Test Area</th>
                    <th className="p-3 text-left text-gray-700 dark:text-gray-300">Project</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx) => (
                    <tr 
                      key={tx.transaction_id} 
                      onClick={() => setSelectedTransactionId(tx.transaction_id)}
                      className={`border-b dark:border-gray-700 cursor-pointer transition-colors ${
                        selectedTransactionId === tx.transaction_id 
                          ? "bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/40" 
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      <td className="p-3 text-gray-800 dark:text-gray-200">{new Date(tx.created_at).toLocaleString()}</td>
                      <td className="p-3 text-gray-800 dark:text-gray-200">{tx.transaction_type}</td>
                      <td className="p-3 text-gray-800 dark:text-gray-200">{tx.employee_name}</td>
                      <td className={`p-3 text-gray-800 dark:text-gray-200 ${selectedTransactionId === tx.transaction_id ? "text-blue-700 dark:text-blue-400 font-bold" : ""}`}>{tx.item_name || "N/A"}</td>
                      <td className="p-3 text-gray-800 dark:text-gray-200">{tx.item_part_number || "N/A"}</td>
                      <td className="p-3 text-gray-800 dark:text-gray-200">{tx.quantity_used}</td>
                      <td className="p-3 text-gray-800 dark:text-gray-200">{tx.fixture_name || "N/A"}</td>
                      <td className="p-3 text-gray-800 dark:text-gray-200">{tx.test_area || "N/A"}</td>
                      <td className="p-3 text-gray-800 dark:text-gray-200">{tx.project_name || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {transactions.length > ROWS_PER_PAGE && (
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
      )}
    </div>
  );
}

