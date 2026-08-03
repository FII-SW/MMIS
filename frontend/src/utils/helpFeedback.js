const STORAGE_KEY = "mmis_help_feedback";

export function recordHelpFeedback(articleId, helpful) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data[articleId]) {
      data[articleId] = { yes: 0, no: 0 };
    }
    if (helpful) data[articleId].yes += 1;
    else data[articleId].no += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getHelpFeedback(articleId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data[articleId] || null;
  } catch {
    return null;
  }
}
