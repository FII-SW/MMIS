import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";

export default function TransferItemPage() {
  const navigate = useNavigate();
  const MIN_SEARCH_LENGTH = 2;
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const inventoryRes = await API.get("/inventory/");
      const allItems = Array.isArray(inventoryRes.data) ? inventoryRes.data : [];
      setInventoryItems(allItems);
    } catch (err) {
      console.error("Error loading data:", err);
      alert("Failed to load transfer data");
    } finally {
      setLoading(false);
    }
  };

  /** One row per inventory record — same name/part can appear multiple times for different projects/test areas. */
  const matchedItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length < MIN_SEARCH_LENGTH) return [];
    const rows = inventoryItems.filter((item) => {
      const name = (item.item_name || "").toLowerCase();
      const part = (item.item_part_number || "").toLowerCase();
      return name.includes(q) || part.includes(q);
    });
    rows.sort((a, b) => {
      const byName = (a.item_name || "").localeCompare(b.item_name || "");
      if (byName !== 0) return byName;
      const byPart = (a.item_part_number || "").localeCompare(b.item_part_number || "");
      if (byPart !== 0) return byPart;
      const byProj = (a.project_name || "").localeCompare(b.project_name || "");
      if (byProj !== 0) return byProj;
      return (a.test_area || "").localeCompare(b.test_area || "");
    });
    return rows;
  }, [inventoryItems, searchTerm]);

  if (loading) {
    return (
      <PageLoadingState title="Transfer" onBack={() => navigate("/dashboard")} message="Loading transfer page..." />
    );
  }

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Transfer" onBack={() => navigate("/dashboard")} />

      <div className="max-w-6xl mx-auto px-6 lg:px-10 pb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 transition-colors">
          <h2 className="text-xl font-bold mb-3 text-gray-800 dark:text-gray-200">Search</h2>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedItemId("");
            }}
            placeholder="Search"
            aria-label="Search box"
            className="w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg transition-colors"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Enter at least {MIN_SEARCH_LENGTH} characters to search.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Matched Items</h2>
            {matchedItems.length > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {matchedItems.length} row{matchedItems.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {searchTerm.trim().length < MIN_SEARCH_LENGTH ? (
            <p className="text-gray-500 dark:text-gray-400">Start typing to see matched items.</p>
          ) : matchedItems.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No matching item found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {matchedItems.map((item) => {
                const id = String(item.item_id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedItemId(id)}
                    className={`text-left border rounded-lg p-4 transition-colors ${
                      selectedItemId === id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="font-semibold text-gray-800 dark:text-gray-200">{item.item_name || "N/A"}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Part #: {item.item_part_number || "N/A"}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                      <span className="text-gray-500 dark:text-gray-400">Project: </span>
                      {item.project_name || "N/A"}
                      {item.test_area != null && item.test_area !== "" && (
                        <>
                          <span className="text-gray-400 dark:text-gray-500 mx-1">·</span>
                          <span className="text-gray-500 dark:text-gray-400">Test area: </span>
                          {item.test_area}
                        </>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Qty: {item.item_current_quantity ?? "—"} {item.item_unit || ""}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
