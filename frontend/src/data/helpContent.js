/**
 * MMIS help knowledge base — grounded guides for in-app assistance.
 * Articles are matched by route, role, and keyword search.
 */

/** @typedef {{ label: string, path: string }} HelpLink */
/** @typedef {{ id: string, title: string, summary: string, steps: string[], links?: HelpLink[], roles?: string[], routes?: string[], keywords?: string[] }} HelpArticle */

/** @type {HelpArticle[]} */
export const HELP_ARTICLES = [
  {
    id: "getting-started",
    title: "Getting started with MMIS",
    summary: "Overview of the Material Management Inventory System and main menu items.",
    steps: [
      "Sign in with your employee username and password.",
      "Use the left sidebar to open Request, Return, Reports, Alerts, Documents, and more.",
      "Use the blue Back button at the top-left of each page to go to the previous step.",
      "Admins also see Restock and Transfer in the sidebar.",
    ],
    links: [{ label: "Open Dashboard", path: "/dashboard" }],
    keywords: ["start", "overview", "navigation", "menu", "mmis"],
    routes: ["/dashboard"],
  },
  {
    id: "request-flow",
    title: "How do I request an item?",
    summary: "Check out inventory for a project and test area.",
    steps: [
      "Open Request from the sidebar.",
      "Select your project. Hi-Lo, Flying Probe, and Development skip test area selection.",
      "For other projects, choose a test area (for example FBT_Agora or ICT_Mobo).",
      "Search for the item, open it, enter quantity, and submit the request.",
      "Your checkout appears under Return when you need to bring items back.",
    ],
    links: [
      { label: "Start Request", path: "/dashboard/request" },
      { label: "View Returns", path: "/dashboard/return" },
    ],
    keywords: ["request", "checkout", "borrow", "take", "item", "project", "test area"],
    routes: ["/dashboard/request"],
  },
  {
    id: "test-area-selection",
    title: "Why do I need to select a test area?",
    summary: "Test areas track where materials are used on the floor.",
    steps: [
      "Most projects require a test area so inventory is attributed to the correct line or station.",
      "Hi-Lo, Flying Probe, and Development go straight to item search without a test area.",
      "If a test area is missing from the list, contact an admin to confirm it is configured.",
      "Common test areas include ICT_Mobo, BSI_Mobo, FBT_Agora, TOOLS, ORT, and L10_Racks.",
    ],
    links: [{ label: "Request — Select Project", path: "/dashboard/request" }],
    keywords: ["test area", "fbt", "agora", "ict", "missing", "filter"],
    routes: ["/dashboard/request/test-area", "/dashboard/restock/test-area"],
  },
  {
    id: "return-flow",
    title: "How do I return an item?",
    summary: "Return checked-out items to inventory.",
    steps: [
      "Open Return from the sidebar.",
      "Find your active checkout in the list (only your open requests are shown).",
      "Click the item to open the return form.",
      "Enter the quantity you are returning and confirm.",
      "Partial returns are supported — return the remaining quantity later if needed.",
    ],
    links: [{ label: "Open Returns", path: "/dashboard/return" }],
    keywords: ["return", "bring back", "checkout", "active", "transaction"],
    routes: ["/dashboard/return"],
  },
  {
    id: "low-stock-alerts",
    title: "How do Low Stock Alerts work?",
    summary: "Find items below minimum quantity by project and test area.",
    steps: [
      "Open Low Stock Alerts from the sidebar.",
      "Filter by project, test area, or search by item name.",
      "Test area filters include predefined areas even when no items are currently low.",
      "Use this page to prioritize restocking before production runs out of material.",
    ],
    links: [{ label: "Open Low Stock Alerts", path: "/dashboard/alerts" }],
    keywords: ["low stock", "alert", "minimum", "filter", "test area", "empty"],
    routes: ["/dashboard/alerts"],
  },
  {
    id: "reports-overview",
    title: "How do I run reports?",
    summary: "Export and review inventory, spending, and custom data.",
    steps: [
      "Open Reports from the sidebar.",
      "Choose Current Inventory, Low Stock, Customized, or Spending report.",
      "Apply filters (project, test area, date range where available).",
      "Download or review the data on screen.",
    ],
    links: [{ label: "Open Reports", path: "/dashboard/reports" }],
    keywords: ["report", "export", "inventory", "spending", "csv", "excel"],
    routes: ["/dashboard/reports"],
  },
  {
    id: "activity-history",
    title: "What is Activity History?",
    summary: "Audit trail of requests, returns, restocks, and other actions.",
    steps: [
      "Open Activity History from the sidebar.",
      "Filter by employee, action type, project, or date.",
      "Use this to trace who changed inventory and when.",
    ],
    links: [{ label: "Open Activity History", path: "/dashboard/activity" }],
    keywords: ["activity", "history", "audit", "log", "who"],
    routes: ["/dashboard/activity"],
  },
  {
    id: "documents-upload",
    title: "How do I upload project documents?",
    summary: "Admins can upload SOPs and project files to the document library.",
    steps: [
      "Open Documents from the sidebar (admin access required for upload).",
      "Click Upload and choose a file (PDF, Office docs, images — max 10 MB).",
      "Select document scope: Project Document or Common Department Document.",
      "For project docs, pick the project and optional test area, then submit.",
      "If upload fails with a session error, log out and sign in again, then retry.",
    ],
    links: [{ label: "Open Documents", path: "/dashboard/documents" }],
    roles: ["admin"],
    keywords: ["document", "upload", "sop", "file", "401", "token", "expired"],
    routes: ["/dashboard/documents"],
  },
  {
    id: "documents-view",
    title: "How do I find or download documents?",
    summary: "Search and filter project-wise documents.",
    steps: [
      "Open Documents from the sidebar.",
      "Filter by project, test area, or document type.",
      "Use Search Documents to find files by name, project, or uploader.",
      "Click Download or Preview (when supported) on any document row.",
      "Pin important documents with the star icon for quick access.",
    ],
    links: [{ label: "Open Documents", path: "/dashboard/documents" }],
    keywords: ["document", "download", "preview", "search", "pin", "sop"],
    routes: ["/dashboard/documents"],
  },
  {
    id: "restock-flow",
    title: "How do I restock inventory? (Admin)",
    summary: "Add or update stock quantities and fixtures.",
    steps: [
      "Open Restock from the sidebar (admin only).",
      "Select project, then test area (unless the project skips test area).",
      "Choose an existing item to edit quantity or use Add New for new stock or fixtures.",
      "Save changes — updates appear immediately in search and reports.",
    ],
    links: [{ label: "Start Restock", path: "/dashboard/restock" }],
    roles: ["admin"],
    keywords: ["restock", "add stock", "quantity", "fixture", "admin"],
    routes: ["/dashboard/restock"],
  },
  {
    id: "transfer-items",
    title: "How do I transfer items between areas? (Admin)",
    summary: "Move inventory between projects or test areas.",
    steps: [
      "Open Transfer from the sidebar (admin only).",
      "Select source and destination project/test area.",
      "Choose the item and quantity to transfer.",
      "Confirm — both locations update after a successful transfer.",
    ],
    links: [{ label: "Open Transfer", path: "/dashboard/transfer" }],
    roles: ["admin"],
    keywords: ["transfer", "move", "between", "project", "admin"],
    routes: ["/dashboard/transfer"],
  },
  {
    id: "change-password",
    title: "How do I change my password?",
    summary: "Update your MMIS login password.",
    steps: [
      "Open your profile menu or go to Change Password from the dashboard area.",
      "Enter your current password and a new password.",
      "Save — you will stay signed in with your existing session.",
    ],
    links: [{ label: "Change Password", path: "/dashboard/change-password" }],
    keywords: ["password", "login", "credentials", "reset"],
    routes: ["/dashboard/profile", "/dashboard/change-password"],
  },
  {
    id: "session-expired",
    title: "Why do I see “Invalid or expired token”?",
    summary: "Your login session timed out or needs to be refreshed.",
    steps: [
      "This usually means your session expired (tokens last about 8 hours).",
      "Log out using the app menu, then sign in again with your username and password.",
      "Retry the action (upload, request, etc.) after logging back in.",
      "If the error continues after a fresh login, contact your MMIS admin or IT team.",
    ],
    links: [{ label: "Go to Login", path: "/" }],
    keywords: ["401", "token", "expired", "unauthorized", "login", "session", "upload failed"],
  },
  {
    id: "admin-vs-user",
    title: "What is the difference between Admin and User?",
    summary: "Role-based access in MMIS.",
    steps: [
      "All signed-in users can Request, Return, view Reports, Alerts, Activity, and Documents.",
      "Admins can also Restock, Transfer inventory, upload/edit/delete documents, and manage stock.",
      "If an action is missing from your screen, you likely need admin access — contact your supervisor.",
    ],
    keywords: ["admin", "user", "role", "permission", "access", "upload"],
  },
  {
    id: "contact-support",
    title: "Still need help?",
    summary: "Escalate to your team when the guide does not resolve the issue.",
    steps: [
      "Note the page you were on and the exact error message (if any).",
      "Check Project Documents for an SOP related to your task.",
      "Contact your MMIS administrator or line supervisor for access or data issues.",
      "For IT or server issues (login works but all pages fail), contact your infrastructure team.",
    ],
    links: [
      { label: "Browse Documents", path: "/dashboard/documents" },
      { label: "Open Dashboard", path: "/dashboard" },
    ],
    keywords: ["help", "support", "contact", "admin", "it", "escalate"],
  },
];

const DEFAULT_ROLES = ["admin", "user"];

/** Human-readable label for the current route. */
export function getPageContextLabel(pathname) {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return "Dashboard";
  if (pathname.startsWith("/dashboard/request/test-area")) return "Request — Test Area";
  if (pathname.startsWith("/dashboard/request/search")) return "Request — Search Items";
  if (pathname.startsWith("/dashboard/request/item")) return "Request — Item Details";
  if (pathname.startsWith("/dashboard/request")) return "Request — Project";
  if (pathname.startsWith("/dashboard/return/item")) return "Return — Item";
  if (pathname.startsWith("/dashboard/return")) return "Return";
  if (pathname.startsWith("/dashboard/restock")) return "Restock";
  if (pathname.startsWith("/dashboard/alerts")) return "Low Stock Alerts";
  if (pathname.startsWith("/dashboard/reports")) return "Reports";
  if (pathname.startsWith("/dashboard/activity")) return "Activity History";
  if (pathname.startsWith("/dashboard/documents")) return "Project Documents";
  if (pathname.startsWith("/dashboard/transfer")) return "Transfer";
  if (pathname.startsWith("/dashboard/profile")) return "Profile";
  if (pathname.startsWith("/dashboard/change-password")) return "Change Password";
  return "MMIS";
}

function articleMatchesRole(article, role) {
  const allowed = article.roles || DEFAULT_ROLES;
  if (!role) return true;
  return allowed.includes(role);
}

function articleMatchesRoute(article, pathname) {
  if (!article.routes?.length) return false;
  return article.routes.some((route) => {
    if (route === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/dashboard/";
    }
    return pathname.startsWith(route);
  });
}

function articleMatchesQuery(article, query) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const haystack = [
    article.title,
    article.summary,
    ...(article.steps || []),
    ...(article.keywords || []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Articles relevant to the current page (quick topics). */
export function getContextualArticles(pathname, role) {
  return HELP_ARTICLES.filter(
    (a) => articleMatchesRole(a, role) && articleMatchesRoute(a, pathname)
  );
}

/** All articles visible to the user, optionally filtered by search. */
export function searchHelpArticles(query, role) {
  return HELP_ARTICLES.filter(
    (a) => articleMatchesRole(a, role) && articleMatchesQuery(a, query)
  );
}

/** Suggested quick prompts for the chat-style input. */
export function getSuggestedPrompts(pathname, role) {
  const contextual = getContextualArticles(pathname, role);
  const fallback = HELP_ARTICLES.filter((a) =>
    ["getting-started", "request-flow", "return-flow", "session-expired", "contact-support"].includes(a.id)
  );
  const merged = [...contextual, ...fallback];
  const seen = new Set();
  return merged
    .filter((a) => articleMatchesRole(a, role))
    .filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    })
    .slice(0, 5)
    .map((a) => a.title);
}
