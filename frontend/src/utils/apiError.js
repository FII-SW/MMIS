/**
 * Readable message from an API error. FastAPI validation errors (422) send `detail` as a list of
 * objects, which would otherwise show up as "[object Object]".
 */
export function apiErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null;
        const message = (item?.msg || "is invalid").replace(/^Value error, /, "");
        return field && field !== "body" ? `${String(field).replace(/_/g, " ")}: ${message}` : message;
      })
      .join("\n");
  }
  return fallback;
}
