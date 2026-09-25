import { useEffect, useMemo, useState } from "react";
import API from "../../api";

const MAX_MATCHES = 8;

export default function PMPartsPicker({ fixture, parts, onChange }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    API.get("/inventory/", { params: { project: fixture.project_name } })
      .then((res) => {
        const area = fixture.test_area;
        setInventory((res.data || []).filter((item) => !item.test_area || item.test_area === area));
      })
      .catch((err) => {
        console.error("Error loading inventory for PM parts:", err);
        setError("Could not load inventory.");
      })
      .finally(() => setLoading(false));
  }, [fixture.project_name, fixture.test_area]);

  const byId = useMemo(() => Object.fromEntries(inventory.map((item) => [item.item_id, item])), [inventory]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(parts.map((p) => p.item_id));
    return inventory
      .filter((item) => !chosen.has(item.item_id))
      .filter((item) =>
        [item.item_name, item.item_part_number, item.item_description].some((value) =>
          (value || "").toLowerCase().includes(q)
        )
      )
      .slice(0, MAX_MATCHES);
  }, [inventory, parts, search]);

  const addPart = (item) => {
    onChange([...parts, { item_id: item.item_id, quantity: 1 }]);
    setSearch("");
  };

  const setQuantity = (itemId, quantity) => {
    onChange(parts.map((p) => (p.item_id === itemId ? { ...p, quantity } : p)));
  };

  const removePart = (itemId) => onChange(parts.filter((p) => p.item_id !== itemId));

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">📦 Parts taken from stock</p>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        Parts added here are deducted from {fixture.project_name} inventory and show in this fixture&apos;s spare-parts history.
      </p>

      {parts.length > 0 && (
        <ul className="mb-2 divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {parts.map((part) => {
            const item = byId[part.item_id];
            const stock = item?.item_current_quantity ?? 0;
            const tooMany = part.quantity > stock;
            return (
              <li key={part.item_id} className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">
                  {item?.item_name || `Item #${part.item_id}`}
                  {item?.item_part_number && (
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({item.item_part_number})</span>
                  )}
                </span>
                <span className={`text-xs ${tooMany ? "font-semibold text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                  {stock} in stock
                </span>
                <input
                  type="number"
                  min={1}
                  value={part.quantity}
                  onChange={(e) => setQuantity(part.item_id, Math.max(1, Number(e.target.value) || 1))}
                  aria-label="Quantity"
                  className="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removePart(part.item_id)}
                  className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {loading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading inventory…</p>
      ) : error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item name or part number to add…"
            className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          {search.trim() && (
            <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No matching items in this project.</li>
              ) : (
                matches.map((item) => (
                  <li key={item.item_id}>
                    <button
                      type="button"
                      onClick={() => addPart(item)}
                      disabled={(item.item_current_quantity ?? 0) <= 0}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700"
                    >
                      <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">
                        {item.item_name}
                        {item.item_part_number && (
                          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({item.item_part_number})</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                        {(item.item_current_quantity ?? 0) > 0 ? `${item.item_current_quantity} in stock` : "Out of stock"}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
