// src/pages/RestockItemPage.jsx
import { useEffect, useState, useMemo } from "react";
import API from "../api";
import { useNavigate, useSearchParams } from "react-router-dom";
import AccessDenied from "../components/AccessDenied";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";

export default function RestockItemPage() {
  const [items, setItems] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [accessLevel, setAccessLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const project = params.get("project");
  const test_area = params.get("test_area");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setAccessLevel(payload.role);
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!project) {
      setItemsLoading(false);
      return;
    }

    const skipTestAreaProjects = ["Hi-Lo", "Flying Probe", "Development"];
    const requiresTestArea = !skipTestAreaProjects.includes(project);

    if (requiresTestArea && !test_area) {
      setItemsLoading(false);
      return;
    }

    setItemsLoading(true);
    const encodedProject = encodeURIComponent(project);
    let url = `/inventory/?project=${encodedProject}`;
    if (test_area) {
      url += `&test_area=${encodeURIComponent(test_area)}`;
    }

    API.get(url)
      .then((res) => {
        setItems(res.data || []);
      })
      .catch((err) => {
        console.error("Failed to load items", err);
        setItems([]);
      })
      .finally(() => {
        setItemsLoading(false);
      });
  }, [project, test_area]);

  const displayItems = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = item?.item_name?.toLowerCase() || "";
      const part = (item?.item_part_number || "").toLowerCase();
      const desc = (item?.item_description || "").toLowerCase();
      const id = String(item?.item_id ?? "");
      return name.includes(q) || part.includes(q) || desc.includes(q) || id.includes(q);
    });
  }, [items, searchInput]);

  const handleBack = () => {
    if (test_area) {
      navigate(`/dashboard/restock/test-area?project=${encodeURIComponent(project)}`);
    } else {
      navigate("/dashboard/restock/project");
    }
  };

  if (loading) {
    return (
      <PageLoadingState title="Restock — select item" onBack={() => navigate("/dashboard/restock/project")} />
    );
  }

  if (accessLevel !== "admin") {
    return <AccessDenied feature="the Restock feature" backTo="/dashboard" />;
  }

  const skipTestAreaProjects = ["Hi-Lo", "Flying Probe", "Development"];
  const requiresTestArea = project && !skipTestAreaProjects.includes(project);

  if (!project || (requiresTestArea && !test_area)) {
    return (
      <div className="min-h-screen bg-transparent transition-colors">
        <Header />
        <PageHeaderWithBack title="Restock — select item" onBack={() => navigate("/dashboard/restock")} />
        <div className="text-center px-4 py-12">
          <p className="text-red-500 dark:text-red-400 mb-4">
            {!project ? "Missing project parameter" : "Missing test area parameter"}
          </p>
        </div>
      </div>
    );
  }

  const handleSelect = (item) => {
    let url = `/dashboard/restock/item/${item.item_id}/edit?project=${encodeURIComponent(project)}`;
    if (test_area) {
      url += `&test_area=${encodeURIComponent(test_area)}`;
    }
    navigate(url);
  };

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    const apiBaseUrl =
      import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://127.0.0.1:8000");
    return `${apiBaseUrl}${imageUrl}`;
  };

  const renderRow = (item) => (
    <div
      key={item.item_id}
      role="button"
      tabIndex={0}
      onClick={() => handleSelect(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect(item);
        }
      }}
      className="p-3 border-b border-gray-100 dark:border-gray-600 last:border-b-0 hover:bg-blue-50 dark:hover:bg-gray-600/80 cursor-pointer transition-colors flex items-center gap-3 text-left group"
    >
      {getImageUrl(item.item_image_url) ? (
        <div className="flex-shrink-0">
          <img
            src={getImageUrl(item.item_image_url)}
            alt=""
            className="w-14 h-14 object-cover rounded border border-gray-200 dark:border-gray-600"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className="flex-shrink-0 w-14 h-14 bg-gray-100 dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500">
          No img
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.item_name}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
          <span>
            Qty <strong className="text-gray-800 dark:text-gray-200">{item.item_current_quantity}</strong>
            {item.item_unit ? ` ${item.item_unit}` : ""}
          </span>
          <span className="hidden sm:inline">|</span>
          <span>Part {item.item_part_number || "—"}</span>
          {item.item_min_count != null && (
            <>
              <span className="hidden sm:inline">|</span>
              <span>Min {item.item_min_count}</span>
            </>
          )}
        </div>
      </div>
      <span className="flex-shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 opacity-80 group-hover:opacity-100">
        Edit →
      </span>
    </div>
  );

  return (
    <div className="min-h-0 flex flex-col bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Restock — select item" onBack={handleBack} />

      <p className="text-center mt-4 text-gray-700 dark:text-gray-300 font-semibold text-base sm:text-lg px-4">
        Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
        {test_area && (
          <>
            {" "}
            — Test Area: <span className="text-blue-600 dark:text-blue-400">{test_area}</span>
          </>
        )}
      </p>

      <div className="p-4 sm:p-6 pt-2 rounded-lg w-full max-w-4xl mx-auto mt-2 flex-1 min-h-0 flex flex-col">
        <input
          type="search"
          className="w-full p-3 border-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          placeholder="Search"
          aria-label="Search box"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          autoComplete="off"
        />

        {itemsLoading ? (
          <div className="mt-8 text-center text-gray-500 dark:text-gray-400">Loading items…</div>
        ) : items.length === 0 ? (
          <div className="mt-8 p-6 text-center text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-600">
            No items found for this project{test_area ? " and test area" : ""}.
          </div>
        ) : (
          <div className="mt-5 flex flex-col min-h-0 flex-1">
            <div className="flex items-center justify-between mb-2 px-0.5 gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing{" "}
                <strong className="text-gray-800 dark:text-gray-200">{displayItems.length}</strong>
                {searchInput.trim() ? (
                  <>
                    {" "}
                    of {items.length} items
                  </>
                ) : (
                  ` item${items.length !== 1 ? "s" : ""}`
                )}
              </span>
              {searchInput.trim() && displayItems.length === 0 && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-md overflow-hidden flex flex-col min-h-0 max-h-[min(70vh,560px)]">
              {displayItems.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No items match &quot;{searchInput.trim()}&quot;. Clear search to see all items.
                </div>
              ) : (
                <div className="overflow-y-auto overscroll-contain">{displayItems.map((item) => renderRow(item))}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
