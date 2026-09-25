import { formatDateTime } from "./formatDate";

export default function SparePartsHistory({ entries }) {
  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        No items have been requested for this fixture yet.
      </p>
    );
  }

  const totalRequested = entries
    .filter((e) => e.transaction_type === "request")
    .reduce((sum, e) => sum + (e.quantity || 0), 0);
  const totalReturned = entries
    .filter((e) => e.transaction_type === "return")
    .reduce((sum, e) => sum + (e.quantity || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="rounded-md bg-red-50 px-2.5 py-1 font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Requested: {totalRequested}
        </span>
        <span className="rounded-md bg-green-50 px-2.5 py-1 font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
          Returned: {totalReturned}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 font-semibold">Part #</th>
              <th className="px-3 py-2 font-semibold text-right">Qty</th>
              <th className="px-3 py-2 font-semibold">By</th>
              <th className="px-3 py-2 font-semibold">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {entries.map((entry) => (
              <tr key={entry.transaction_id}>
                <td className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300">
                  {formatDateTime(entry.created_at)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      entry.transaction_type === "request"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    }`}
                  >
                    {entry.transaction_type}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{entry.item_name || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                  {entry.item_part_number || "—"}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-gray-800 dark:text-gray-100">
                  {entry.transaction_type === "request" ? "-" : "+"}
                  {entry.quantity}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{entry.employee_name || "—"}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{entry.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
