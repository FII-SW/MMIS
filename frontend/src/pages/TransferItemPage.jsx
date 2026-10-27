import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import PageLoadingState from "../components/PageLoadingState";
import { useNotifications } from "../contexts/NotificationContext";
import { apiErrorMessage } from "../utils/apiError";

const MIN_SEARCH_LENGTH = 2;

function catalogKey(item) {
  return [
    String(item?.item_name || "").trim().toLowerCase(),
    String(item?.item_part_number || "").trim().toLowerCase(),
    String(item?.item_description || "").trim().toLowerCase(),
  ].join("\0");
}

function sameCatalog(a, b) {
  if (!a || !b || String(a.item_id) === String(b.item_id)) return false;
  return catalogKey(a) === catalogKey(b);
}

function locationLabel(item) {
  if (!item) return "—";
  const area = item.test_area ? ` · ${item.test_area}` : "";
  return `${item.project_name || "No project"}${area}`;
}

function ItemCard({ item, selected, onSelect, badge }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${
        selected
          ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20"
          : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 font-semibold text-gray-800 dark:text-gray-200">{item.item_name || "N/A"}</div>
        {badge && (
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">Part #: {item.item_part_number || "N/A"}</div>
      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{locationLabel(item)}</div>
      <div className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
        Qty: {item.item_current_quantity ?? "—"} {item.item_unit || ""}
      </div>
    </button>
  );
}

export default function TransferItemPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { addNotification } = useNotifications();

  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const sourcePrefill = params.get("source_item_id") || "";
  const destPrefill = params.get("dest_item_id") || "";
  const [sourceId, setSourceId] = useState(sourcePrefill);
  const [destId, setDestId] = useState(destPrefill);
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [fixtures, setFixtures] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setLoading(true);
    API.get("/inventory/")
      .then((res) => {
        const allItems = Array.isArray(res.data) ? res.data : [];
        setInventoryItems(allItems);
        if (sourcePrefill || destPrefill) {
          const seed = allItems.find((item) => String(item.item_id) === String(sourcePrefill || destPrefill));
          if (seed?.item_name) setSearchTerm(seed.item_name);
        }
      })
      .catch((err) => {
        console.error("Error loading transfer data:", err);
        setError(apiErrorMessage(err, "Failed to load inventory for transfer."));
      })
      .finally(() => setLoading(false));
  }, [sourcePrefill, destPrefill]);

  const sourceItem = useMemo(
    () => inventoryItems.find((item) => String(item.item_id) === String(sourceId)) || null,
    [inventoryItems, sourceId]
  );
  const destItem = useMemo(
    () => inventoryItems.find((item) => String(item.item_id) === String(destId)) || null,
    [inventoryItems, destId]
  );

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

  const destinations = useMemo(() => {
    if (!sourceItem) return [];
    return inventoryItems
      .filter((item) => sameCatalog(sourceItem, item))
      .sort((a, b) => {
        const byProj = (a.project_name || "").localeCompare(b.project_name || "");
        if (byProj !== 0) return byProj;
        return (a.test_area || "").localeCompare(b.test_area || "");
      });
  }, [inventoryItems, sourceItem]);

  useEffect(() => {
    if (!destItem) {
      setFixtures([]);
      setFixtureId("");
      return;
    }
    const query = { project: destItem.project_name || "" };
    if (destItem.test_area) query.test_area = destItem.test_area;
    API.get("/fixtures/filter", { params: query })
      .then((res) => setFixtures(Array.isArray(res.data) ? res.data : []))
      .catch(() => setFixtures([]));
  }, [destItem]);

  const maxQty = sourceItem?.item_current_quantity ?? 0;
  const qtyNumber = Number(quantity);
  const qtyValid = Number.isInteger(qtyNumber) && qtyNumber > 0 && qtyNumber <= maxQty;
  const canSubmit = Boolean(sourceItem && destItem && sameCatalog(sourceItem, destItem) && qtyValid && !saving);

  const selectSource = (item) => {
    setSourceId(String(item.item_id));
    setError("");
    setSuccess("");
    if (destId && String(destId) === String(item.item_id)) setDestId("");
    if (destItem && !sameCatalog(item, destItem)) setDestId("");
  };

  const selectDest = (item) => {
    setDestId(String(item.item_id));
    setFixtureId("");
    setError("");
    setSuccess("");
  };

  const submit = async () => {
    if (!canSubmit) {
      if (!sourceItem) setError("Select the source item.");
      else if (!destItem) setError("Select the destination item.");
      else if (!qtyValid) setError(`Enter a quantity between 1 and ${maxQty}.`);
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await API.post("/inventory/transfer", {
        source_item_id: Number(sourceItem.item_id),
        dest_item_id: Number(destItem.item_id),
        quantity: qtyNumber,
        fixture_id: fixtureId ? Number(fixtureId) : null,
        remarks,
      });
      const sourceQty = res.data?.source_quantity;
      const destQty = res.data?.dest_quantity;
      setInventoryItems((prev) =>
        prev.map((item) => {
          if (String(item.item_id) === String(sourceItem.item_id)) {
            return { ...item, item_current_quantity: sourceQty };
          }
          if (String(item.item_id) === String(destItem.item_id)) {
            return { ...item, item_current_quantity: destQty };
          }
          return item;
        })
      );
      const message = `Transferred ${qtyNumber} × ${sourceItem.item_name} from ${locationLabel(sourceItem)} to ${locationLabel(destItem)}.`;
      setSuccess(message);
      addNotification(message);
      setQuantity("");
      setRemarks("");
      setFixtureId("");
    } catch (err) {
      setError(apiErrorMessage(err, "Transfer failed. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoadingState title="Transfer" onBack={() => navigate("/dashboard")} message="Loading transfer page..." />;
  }

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title="Transfer" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-6xl space-y-5 px-4 pb-10 sm:px-6 lg:px-10">
        <p className="text-center text-sm text-gray-600 dark:text-gray-300">
          Move quantity of the same part from one project or test area to another. Both locations must already have that
          item in inventory.
        </p>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-3 text-lg font-bold text-gray-800 dark:text-gray-100">1. Find the part</h2>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSuccess("");
            }}
            placeholder="Search by item name or part number"
            aria-label="Search inventory"
            className="w-full rounded-lg border border-gray-300 p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Enter at least {MIN_SEARCH_LENGTH} characters. Then pick the source location below.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">2. Source (take from)</h2>
            {matchedItems.length > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {matchedItems.length} row{matchedItems.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {searchTerm.trim().length < MIN_SEARCH_LENGTH ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Start typing to see matching inventory rows.</p>
          ) : matchedItems.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No matching item found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {matchedItems.map((item) => (
                <ItemCard
                  key={item.item_id}
                  item={item}
                  selected={String(sourceId) === String(item.item_id)}
                  onSelect={selectSource}
                  badge={String(sourceId) === String(item.item_id) ? "Source" : null}
                />
              ))}
            </div>
          )}
        </div>

        {sourceItem && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-2 text-lg font-bold text-gray-800 dark:text-gray-100">3. Destination (move to)</h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Same part as <span className="font-semibold">{sourceItem.item_name}</span>
              {sourceItem.item_part_number ? ` (${sourceItem.item_part_number})` : ""}. Only other project / test area
              rows are listed.
            </p>

            {destinations.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                No other inventory row exists for this part. Add the item to the destination project first (Restock → Add
                New Stock), then transfer quantity here.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {destinations.map((item) => (
                  <ItemCard
                    key={item.item_id}
                    item={item}
                    selected={String(destId) === String(item.item_id)}
                    onSelect={selectDest}
                    badge={String(destId) === String(item.item_id) ? "Destination" : null}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {sourceItem && destItem && (
          <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-800 dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-bold text-gray-800 dark:text-gray-100">4. Quantity and confirm</h2>

            <div className="mb-4 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900/40 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">From</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{locationLabel(sourceItem)}</p>
                <p className="text-gray-600 dark:text-gray-300">
                  Available {maxQty} {sourceItem.item_unit || ""}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">To</p>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{locationLabel(destItem)}</p>
                <p className="text-gray-600 dark:text-gray-300">
                  Current {destItem.item_current_quantity ?? 0} {destItem.item_unit || ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Quantity <span className="text-red-500">*</span>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxQty}
                  step={1}
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  placeholder={`1 to ${maxQty}`}
                  className="w-full rounded-lg border border-gray-300 p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Fixture <span className="font-normal text-gray-500">(optional)</span>
                </span>
                <select
                  value={fixtureId}
                  onChange={(e) => setFixtureId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">None</option>
                  {fixtures.map((fx) => (
                    <option key={fx.fixture_id} value={fx.fixture_id}>
                      {fx.fixture_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Remarks</span>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Why this stock is moving"
                  className="w-full rounded-lg border border-gray-300 p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </label>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </p>
            )}
            {success && (
              <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                {success}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSourceId("");
                  setDestId("");
                  setQuantity("");
                  setRemarks("");
                  setFixtureId("");
                  setError("");
                  setSuccess("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Transferring…" : "Transfer stock"}
              </button>
            </div>
          </div>
        )}

        {!sourceItem && error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
