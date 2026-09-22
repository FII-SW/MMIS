import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectRequiresTestArea } from "../utils/inventoryRules";

const MIN_SEARCH_LENGTH = 2;
const MAX_RESULTS = 50;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }) {
  const value = text || "";
  const q = query.trim();
  if (!q || q.length < MIN_SEARCH_LENGTH) return <>{value}</>;

  const parts = value.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={`${part}-${i}`}
            className="rounded bg-amber-200/90 px-0.5 text-inherit dark:bg-amber-500/40"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${i}`}>{part}</span>
        )
      )}
    </>
  );
}

function stockStatus(item) {
  const qty = Number(item.item_current_quantity) || 0;
  const min = Number(item.item_min_count) || 0;
  if (qty <= 0) return { label: "Out of stock", tone: "red" };
  if (min > 0 && qty <= min) return { label: "Low stock", tone: "amber" };
  return { label: "In stock", tone: "green" };
}

const TONE_CLASS = {
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

export default function DashboardItemSearch({ inventory = [] }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [testAreaFilter, setTestAreaFilter] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [panelOpen, setPanelOpen] = useState(false);

  const projects = useMemo(() => {
    const set = new Set();
    inventory.forEach((item) => {
      if (item.project_name) set.add(item.project_name);
    });
    return [...set].sort();
  }, [inventory]);

  const testAreas = useMemo(() => {
    const set = new Set();
    inventory.forEach((item) => {
      if (!item.test_area) return;
      if (projectFilter && item.project_name !== projectFilter) return;
      set.add(item.test_area);
    });
    return [...set].sort();
  }, [inventory, projectFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasText = q.length >= MIN_SEARCH_LENGTH;
    const hasFilters = Boolean(projectFilter || testAreaFilter || inStockOnly);

    if (!hasText && !hasFilters) return [];

    let matches = inventory.filter((item) => {
      if (projectFilter && item.project_name !== projectFilter) return false;
      if (testAreaFilter && item.test_area !== testAreaFilter) return false;

      const qty = Number(item.item_current_quantity) || 0;
      if (inStockOnly && qty <= 0) return false;

      if (!hasText) return true;

      const name = (item.item_name || "").toLowerCase();
      const part = (item.item_part_number || "").toLowerCase();
      const desc = (item.item_description || "").toLowerCase();
      const project = (item.project_name || "").toLowerCase();
      const testArea = (item.test_area || "").toLowerCase();
      const manufacturer = (item.item_manufacturer || "").toLowerCase();

      return (
        name.includes(q) ||
        part.includes(q) ||
        desc.includes(q) ||
        project.includes(q) ||
        testArea.includes(q) ||
        manufacturer.includes(q)
      );
    });

    matches.sort((a, b) => {
      const aQty = Number(a.item_current_quantity) || 0;
      const bQty = Number(b.item_current_quantity) || 0;
      // Prefer in-stock first, then name/project
      if ((aQty > 0) !== (bQty > 0)) return bQty > 0 ? 1 : -1;
      const byName = (a.item_name || "").localeCompare(b.item_name || "");
      if (byName !== 0) return byName;
      const byProject = (a.project_name || "").localeCompare(b.project_name || "");
      if (byProject !== 0) return byProject;
      return (a.test_area || "").localeCompare(b.test_area || "");
    });

    return matches;
  }, [inventory, query, projectFilter, testAreaFilter, inStockOnly]);

  const visibleResults = filtered.slice(0, MAX_RESULTS);
  const showHint = query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH && !projectFilter && !testAreaFilter && !inStockOnly;
  const showResults =
    panelOpen &&
    (query.trim().length >= MIN_SEARCH_LENGTH || projectFilter || testAreaFilter || inStockOnly);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, projectFilter, testAreaFilter, inStockOnly]);

  useEffect(() => {
    if (projectFilter && testAreaFilter && !testAreas.includes(testAreaFilter)) {
      setTestAreaFilter("");
    }
  }, [projectFilter, testAreaFilter, testAreas]);

  const requestItem = (item) => {
    if (!item) return;
    const project = item.project_name || "";
    const testArea = item.test_area || "";
    let url = `/dashboard/request/item/${item.item_id}?project=${encodeURIComponent(project)}`;
    if (testArea && projectRequiresTestArea(project)) {
      url += `&test_area=${encodeURIComponent(testArea)}`;
    }
    navigate(url);
  };

  const clearAll = () => {
    setQuery("");
    setProjectFilter("");
    setTestAreaFilter("");
    setInStockOnly(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const hasActiveFilters = Boolean(query || projectFilter || testAreaFilter || inStockOnly);

  const onKeyDown = (e) => {
    if (!showResults || visibleResults.length === 0) {
      if (e.key === "Escape") {
        setPanelOpen(false);
        setQuery("");
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPanelOpen(true);
      setActiveIndex((i) => (i + 1) % visibleResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? visibleResults.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      requestItem(visibleResults[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPanelOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div className="mb-4">
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Find item to request
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPanelOpen(true);
            }}
            onFocus={() => setPanelOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search name, part #, manufacturer, project, or test area…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100 dark:placeholder:text-gray-500"
            aria-label="Search inventory items"
            aria-autocomplete="list"
            aria-expanded={showResults}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search text"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              setPanelOpen(true);
            }}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200"
            aria-label="Filter by project"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={testAreaFilter}
            onChange={(e) => {
              setTestAreaFilter(e.target.value);
              setPanelOpen(true);
            }}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200"
            aria-label="Filter by test area"
          >
            <option value="">All test areas</option>
            {testAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => {
                setInStockOnly(e.target.checked);
                setPanelOpen(true);
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            In stock only
          </label>
        </div>

        {showHint && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Type at least {MIN_SEARCH_LENGTH} characters, or use the filters above.
          </p>
        )}

        {showResults && (
          <div
            ref={listRef}
            className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700"
            role="listbox"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-400">
              <span>
                {filtered.length === 0
                  ? "No matches"
                  : `${filtered.length} match${filtered.length === 1 ? "" : "es"}`}
                {filtered.length > MAX_RESULTS ? ` · showing ${MAX_RESULTS}` : ""}
              </span>
              <span className="hidden sm:inline">↑↓ to move · Enter to request · Esc to close</span>
            </div>

            {visibleResults.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No items found. Try a different name, part number, or clear filters.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {visibleResults.map((item, index) => {
                  const status = stockStatus(item);
                  const active = index === activeIndex;
                  const canRequest = (Number(item.item_current_quantity) || 0) > 0;

                  return (
                    <li key={item.item_id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        data-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => requestItem(item)}
                        className={`flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors ${
                          active
                            ? "bg-blue-50 dark:bg-blue-900/30"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700/60"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                              <Highlight text={item.item_name || "Unnamed item"} query={query} />
                            </span>
                            {item.item_part_number && (
                              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                <Highlight text={item.item_part_number} query={query} />
                              </span>
                            )}
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TONE_CLASS[status.tone]}`}>
                              {status.label}
                            </span>
                          </div>

                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              <Highlight text={item.project_name || "No project"} query={query} />
                            </span>
                            {item.test_area ? (
                              <>
                                {" · "}
                                <Highlight text={item.test_area} query={query} />
                              </>
                            ) : null}
                            {" · "}
                            Qty <span className="font-semibold text-gray-700 dark:text-gray-200">{item.item_current_quantity ?? 0}</span>
                            {item.item_manufacturer ? (
                              <>
                                {" · "}
                                <Highlight text={item.item_manufacturer} query={query} />
                              </>
                            ) : null}
                          </p>
                        </div>

                        <span
                          className={`mt-0.5 shrink-0 text-xs font-semibold ${
                            canRequest
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {canRequest ? "Request →" : "View →"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
