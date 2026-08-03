/**
 * MMIS help knowledge base — workflows, projects, and step-by-step guides.
 */
import { getProjects, DEFAULT_PROJECTS } from "../utils/projects";
import { DEFAULT_TEST_AREAS } from "../utils/testAreas";

/** Projects that skip test area selection in Request and Restock. */
export const SKIP_TEST_AREA_PROJECTS = ["Hi-Lo", "Flying Probe", "Development"];

/** @typedef {{ label: string, path: string }} HelpLink */
/** @typedef {{ heading?: string, steps: string[] }} HelpSection */
/** @typedef {{ id: string, label: string, description: string, steps: string[], links?: HelpLink[] }} HelpBranch */

/**
 * @typedef {Object} HelpArticle
 * @property {string} id
 * @property {string} title
 * @property {string} summary
 * @property {string[]} [steps]
 * @property {HelpSection[]} [sections]
 * @property {HelpBranch[]} [branches]
 * @property {HelpLink[]} [links]
 * @property {string[]} [roles]
 * @property {string[]} [routes]
 * @property {string[]} [keywords]
 * @property {string} [icon]
 * @property {string} [category]
 * @property {boolean} [showProjects]
 * @property {boolean} [showTestAreas]
 */

/** Main workflow cards shown on the help home screen. */
export const WORKFLOW_CARDS = [
  {
    id: "request",
    title: "Request Item",
    icon: "📤",
    description: "Check out inventory for your project and test area.",
    color: "blue",
    roles: ["admin", "user"],
    articleId: "request-flow",
  },
  {
    id: "return",
    title: "Return Item",
    icon: "📥",
    description: "Bring checked-out items back to inventory.",
    color: "green",
    roles: ["admin", "user"],
    articleId: "return-flow",
  },
  {
    id: "restock",
    title: "Restock Inventory",
    icon: "📦",
    description: "Update existing stock or add new items (admin).",
    color: "amber",
    roles: ["admin"],
    articleId: "restock-hub",
  },
  {
    id: "transfer",
    title: "Transfer Inventory",
    icon: "🔄",
    description: "Move stock between projects or test areas (admin).",
    color: "purple",
    roles: ["admin"],
    articleId: "transfer-flow",
  },
];

/** @type {HelpArticle[]} */
export const HELP_ARTICLES = [
  {
    id: "getting-started",
    title: "Getting started with MMIS",
    icon: "🏠",
    category: "General",
    summary: "Overview of the Material Management Inventory System.",
    steps: [
      "Sign in with your employee username and password.",
      "Use the left sidebar for Request, Return, Reports, Alerts, Documents, and more.",
      "Use the blue Back button at the top-left to go to the previous step.",
      "Admins also see Restock and Transfer in the sidebar.",
    ],
    showProjects: true,
    links: [{ label: "Open Dashboard", path: "/dashboard" }],
    keywords: ["start", "overview", "navigation", "menu", "mmis"],
    routes: ["/dashboard"],
  },
  {
    id: "request-flow",
    title: "How to request an item",
    icon: "📤",
    category: "Workflows",
    summary: "Check out inventory for a project and test area.",
    showProjects: true,
    showTestAreas: true,
    sections: [
      {
        heading: "Step 1 — Open Request",
        steps: ["Click Request in the left sidebar."],
      },
      {
        heading: "Step 2 — Select your project",
        steps: [
          "Choose your project from the list (see all MMIS projects below).",
          `Projects that skip test area: ${SKIP_TEST_AREA_PROJECTS.join(", ")} — these go straight to item search.`,
          "All other projects require a test area in the next step.",
        ],
      },
      {
        heading: "Step 3 — Select test area (if required)",
        steps: [
          "Pick the test area where the material will be used (for example FBT_Agora, ICT_Mobo, TOOLS).",
          "Skip this step automatically for Hi-Lo, Flying Probe, and Development.",
        ],
      },
      {
        heading: "Step 4 — Find and request the item",
        steps: [
          "Search by item name, part number, or description.",
          "Click the item to open details.",
          "Enter quantity and submit the request.",
          "Your checkout appears under Return when you need to bring items back.",
        ],
      },
    ],
    links: [
      { label: "Start Request", path: "/dashboard/request" },
      { label: "View Returns", path: "/dashboard/return" },
    ],
    keywords: ["request", "checkout", "borrow", "take", "item", "project", "test area"],
    routes: ["/dashboard/request"],
  },
  {
    id: "return-flow",
    title: "How to return an item",
    icon: "📥",
    category: "Workflows",
    summary: "Return checked-out items to inventory.",
    sections: [
      {
        heading: "When to return",
        steps: [
          "Return items when you no longer need them or when a job is complete.",
          "Returns apply to your own active checkouts only.",
        ],
      },
      {
        heading: "Return steps",
        steps: [
          "Open Return from the sidebar.",
          "Find your active checkout in the list.",
          "Click the item to open the return form.",
          "Enter the quantity you are returning and confirm.",
          "Partial returns are supported — return the rest later if needed.",
        ],
      },
    ],
    links: [
      { label: "Open Returns", path: "/dashboard/return" },
      { label: "Start New Request", path: "/dashboard/request" },
    ],
    keywords: ["return", "bring back", "checkout", "active", "transaction"],
    routes: ["/dashboard/return"],
  },
  {
    id: "restock-hub",
    title: "How to restock inventory",
    icon: "📦",
    category: "Workflows",
    summary: "Choose whether you are updating existing stock or creating a new item.",
    showProjects: true,
    showTestAreas: true,
    roles: ["admin"],
    branches: [
      {
        id: "restock-existing",
        label: "Item already exists",
        description: "Update quantity or details for an item already in inventory.",
        steps: [
          "Open Restock from the sidebar.",
          "Select the project, then the test area (unless the project skips test area).",
          "Search for the existing item in the list.",
          "Click the item to open the edit form.",
          "Update quantity, minimum stock, location, or other fields.",
          "Save — changes appear immediately in Request search and Reports.",
        ],
        links: [{ label: "Start Restock", path: "/dashboard/restock" }],
      },
      {
        id: "restock-new-inventory",
        label: "Create new inventory item",
        description: "Add a brand-new part or consumable that is not in the system yet.",
        steps: [
          "Open Restock → select project → select test area (if required).",
          "On the item list page, choose Add New (or go to the add-new option).",
          "Select New Inventory.",
          "Fill in item name, part number, quantity, minimum stock, and optional image.",
          "Save — the new item is available for Request and Reports.",
        ],
        links: [
          { label: "Start Restock", path: "/dashboard/restock" },
          { label: "Add New Stock", path: "/dashboard/restock/project/add-new" },
        ],
      },
      {
        id: "restock-new-fixture",
        label: "Create new fixture",
        description: "Add a new fixture record for tooling or equipment.",
        steps: [
          "Open Restock → select project → select test area (if required).",
          "On the item list page, choose Add New.",
          "Select New Fixtures.",
          "Enter fixture details (name, ID, location, quantity, etc.).",
          "Save — the fixture appears in inventory for that project and test area.",
        ],
        links: [
          { label: "Start Restock", path: "/dashboard/restock" },
          { label: "Add New Fixture", path: "/dashboard/restock/project/add-new-fixture" },
        ],
      },
    ],
    keywords: ["restock", "add stock", "quantity", "fixture", "admin", "existing", "new item", "create"],
    routes: ["/dashboard/restock"],
  },
  {
    id: "test-area-selection",
    title: "Test areas explained",
    icon: "📍",
    category: "Reference",
    summary: "Why test areas matter and which projects skip them.",
    showProjects: true,
    showTestAreas: true,
    sections: [
      {
        heading: "Purpose",
        steps: [
          "Test areas track where materials are used on the production floor.",
          "Inventory counts and requests are tied to project + test area.",
        ],
      },
      {
        heading: "Projects without test area",
        steps: [
          `${SKIP_TEST_AREA_PROJECTS.join(", ")} go directly to item search.`,
          "All other projects require a test area selection.",
        ],
      },
    ],
    links: [{ label: "Request — Select Project", path: "/dashboard/request" }],
    keywords: ["test area", "fbt", "agora", "ict", "missing", "filter"],
    routes: ["/dashboard/request/test-area", "/dashboard/restock/test-area"],
  },
  {
    id: "projects-reference",
    title: "All MMIS projects",
    icon: "🗂️",
    category: "Reference",
    summary: "Complete list of projects available in Request and Restock.",
    showProjects: true,
    sections: [
      {
        heading: "Project list",
        steps: [
          "Select any project when requesting or restocking inventory.",
          "Custom projects added by admins also appear in the list.",
        ],
      },
      {
        heading: "No test area required",
        steps: [`${SKIP_TEST_AREA_PROJECTS.join(", ")}`],
      },
    ],
    keywords: ["project", "astoria", "athena", "turin", "asahi", "hi-lo", "list"],
  },
  {
    id: "low-stock-alerts",
    title: "Low Stock Alerts",
    icon: "⚠️",
    category: "Reports & Alerts",
    summary: "Find items below minimum quantity by project and test area.",
    steps: [
      "Open Low Stock Alerts from the sidebar.",
      "Filter by project, test area, or search by item name.",
      "Predefined test areas appear even when no items are currently low.",
      "Use this page to prioritize restocking before production runs out.",
    ],
    links: [{ label: "Open Low Stock Alerts", path: "/dashboard/alerts" }],
    keywords: ["low stock", "alert", "minimum", "filter"],
    routes: ["/dashboard/alerts"],
  },
  {
    id: "reports-overview",
    title: "Reports",
    icon: "📊",
    category: "Reports & Alerts",
    summary: "Export and review inventory, spending, and custom data.",
    steps: [
      "Open Reports from the sidebar.",
      "Choose Current Inventory, Low Stock, Customized, or Spending report.",
      "Apply filters (project, test area, date range where available).",
      "Download or review the data on screen.",
    ],
    links: [{ label: "Open Reports", path: "/dashboard/reports" }],
    keywords: ["report", "export", "inventory", "spending"],
    routes: ["/dashboard/reports"],
  },
  {
    id: "documents-upload",
    title: "Upload documents (Admin)",
    icon: "📄",
    category: "Documents",
    summary: "Upload SOPs and project files to the document library.",
    roles: ["admin"],
    steps: [
      "Open Documents from the sidebar.",
      "Click Upload and choose a file (max 10 MB).",
      "Select scope: Project Document or Common Department Document.",
      "For project docs, pick project and optional test area, then submit.",
      "If upload fails with a session error, log out and sign in again.",
    ],
    links: [{ label: "Open Documents", path: "/dashboard/documents" }],
    keywords: ["document", "upload", "sop", "401", "token"],
    routes: ["/dashboard/documents"],
  },
  {
    id: "session-expired",
    title: "Session expired / 401 error",
    icon: "🔒",
    category: "Troubleshooting",
    summary: "Your login session timed out or needs to be refreshed.",
    steps: [
      "Sessions expire after about 8 hours.",
      "Log out, then sign in again with your username and password.",
      "Retry the action after logging back in.",
      "Contact MMIS admin if the error continues after a fresh login.",
    ],
    links: [{ label: "Go to Login", path: "/" }],
    keywords: ["401", "token", "expired", "unauthorized", "login", "session"],
  },
  {
    id: "transfer-flow",
    title: "How to transfer inventory (Admin)",
    icon: "🔄",
    category: "Workflows",
    summary: "Move stock between projects or test areas manually.",
    roles: ["admin"],
    sections: [
      {
        heading: "When to use Transfer",
        steps: [
          "Use Transfer when you need to move quantity from one project/test area to another.",
          "Automatic cross-project transfer may also happen during Request when local stock is insufficient.",
        ],
      },
      {
        heading: "Transfer steps",
        steps: [
          "Open Transfer from the sidebar (admin only).",
          "Search for the source inventory row (same part can exist in multiple projects).",
          "Select the item row showing the correct project and test area.",
          "Complete the transfer to the destination (follow on-screen fields).",
          "Check Activity History to confirm the move was recorded.",
        ],
      },
    ],
    links: [
      { label: "Open Transfer", path: "/dashboard/transfer" },
      { label: "Activity History", path: "/dashboard/activity" },
    ],
    keywords: ["transfer", "move", "between", "project", "admin", "cross"],
    routes: ["/dashboard/transfer"],
  },
  {
    id: "activity-history",
    title: "Activity History",
    icon: "📋",
    category: "Reports & Alerts",
    summary: "Audit trail of requests, returns, restocks, and transfers.",
    sections: [
      {
        heading: "What you can see",
        steps: [
          "Every request, return, restock, and related action with employee, project, and timestamp.",
          "Filter by employee, action type, project, test area, or date range.",
        ],
      },
      {
        heading: "Common uses",
        steps: [
          "Trace who checked out a part and when.",
          "Verify a restock or transfer was completed.",
          "Review team activity for a specific project or test area.",
        ],
      },
    ],
    links: [{ label: "Open Activity History", path: "/dashboard/activity" }],
    keywords: ["activity", "history", "audit", "log", "who", "trace"],
    routes: ["/dashboard/activity"],
  },
  {
    id: "customized-report",
    title: "Customized Report",
    icon: "📈",
    category: "Reports & Alerts",
    summary: "Build a filtered inventory report and export to CSV.",
    steps: [
      "Open Reports → Customized Report.",
      "Filter by project, test area, item name, or other available fields.",
      "Review the table results on screen.",
      "Click Download CSV to export the filtered data.",
    ],
    links: [
      { label: "Open Reports", path: "/dashboard/reports" },
      { label: "Customized Report", path: "/dashboard/reports/customized" },
    ],
    keywords: ["custom", "report", "export", "csv", "filter"],
    routes: ["/dashboard/reports/customized"],
  },
  {
    id: "profile-settings",
    title: "Profile & password",
    icon: "👤",
    category: "General",
    summary: "View your profile and change your login password.",
    sections: [
      {
        heading: "Profile",
        steps: [
          "Click your initials in the top-right corner.",
          "Select Profile to view your name and role.",
        ],
      },
      {
        heading: "Change password",
        steps: [
          "From the profile menu, choose Change Password.",
          "Enter your current password and a new password.",
          "Save — you stay signed in after a successful change.",
        ],
      },
    ],
    links: [
      { label: "Profile", path: "/dashboard/profile" },
      { label: "Change Password", path: "/dashboard/change-password" },
    ],
    keywords: ["profile", "password", "account", "settings", "login"],
    routes: ["/dashboard/profile", "/dashboard/change-password"],
  },
  {
    id: "restock-edit-item",
    title: "Edit existing item (Restock)",
    icon: "✏️",
    category: "Workflows",
    summary: "Update quantity or details for an item already in inventory.",
    roles: ["admin"],
    steps: [
      "Restock → select project → select test area (if required).",
      "Search and click the existing item in the list.",
      "Update quantity, minimum stock, location, image, or other fields.",
      "Save — the item updates immediately for Request and Reports.",
    ],
    links: [{ label: "Start Restock", path: "/dashboard/restock" }],
    keywords: ["edit", "update", "existing", "quantity", "restock"],
    routes: ["/dashboard/restock/item"],
  },
  {
    id: "restock-add-stock",
    title: "Add new inventory item (Restock)",
    icon: "➕",
    category: "Workflows",
    summary: "Create a new part or consumable not yet in the system.",
    roles: ["admin"],
    steps: [
      "Restock → project → test area → Add New → New Inventory.",
      "Enter item name, part number, quantity, minimum stock, and unit.",
      "Add an optional image and description.",
      "Save — the item is available for Request immediately.",
    ],
    links: [{ label: "Add New Stock", path: "/dashboard/restock/project/add-new-stock" }],
    keywords: ["new", "create", "inventory", "add stock", "part"],
    routes: ["/dashboard/restock/project/add-new-stock"],
  },
  {
    id: "restock-add-fixture",
    title: "Add new fixture (Restock)",
    icon: "🔧",
    category: "Workflows",
    summary: "Register new fixture tooling for a project and test area.",
    roles: ["admin"],
    steps: [
      "Restock → project → test area → Add New → New Fixtures.",
      "Enter fixture name, ID, and related details.",
      "Save — the fixture appears when requesting items that require a fixture.",
    ],
    links: [{ label: "Add New Fixture", path: "/dashboard/restock/project/add-new-fixture" }],
    keywords: ["fixture", "tooling", "new", "create"],
    routes: ["/dashboard/restock/project/add-new-fixture"],
  },
  {
    id: "view-sops",
    title: "Find SOPs and project documents",
    icon: "📄",
    category: "Documents",
    summary: "Search uploaded procedures and download files for your project.",
    steps: [
      "Open Documents from the sidebar.",
      "Filter by project, test area, or document type.",
      "Use Search Documents to find SOPs by file name or uploader.",
      "Download or preview supported file types.",
      "Admins can upload new SOPs from the Upload button.",
    ],
    links: [{ label: "Open Documents", path: "/dashboard/documents" }],
    keywords: ["sop", "document", "procedure", "manual", "download"],
  },
  {
    id: "contact-support",
    title: "Contact support",
    icon: "💬",
    category: "Troubleshooting",
    summary: "Escalate when guides do not resolve your issue.",
    steps: [
      "Note the page you were on and the exact error message.",
      "Check Project Documents for a related SOP.",
      "Contact your MMIS administrator for access or data issues.",
      "Contact IT for server or network problems.",
    ],
    links: [
      { label: "Browse Documents", path: "/dashboard/documents" },
      { label: "Dashboard", path: "/dashboard" },
    ],
    keywords: ["help", "support", "contact", "admin"],
  },
];

const DEFAULT_ROLES = ["admin", "user"];

export function getAllProjects() {
  return getProjects();
}

export function getDefaultProjects() {
  return DEFAULT_PROJECTS;
}

export function getTestAreaList() {
  return DEFAULT_TEST_AREAS;
}

export function getProjectsWithTestArea() {
  return DEFAULT_PROJECTS.filter((p) => !SKIP_TEST_AREA_PROJECTS.includes(p));
}

export function getProjectsWithoutTestArea() {
  return SKIP_TEST_AREA_PROJECTS;
}

export function getArticleById(id, role) {
  const article = HELP_ARTICLES.find((a) => a.id === id);
  if (!article) return null;
  if (!articleMatchesRole(article, role)) return null;
  return article;
}

export function getPageContextLabel(pathname) {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return "Dashboard";
  if (pathname.startsWith("/dashboard/request/test-area")) return "Request — Test Area";
  if (pathname.startsWith("/dashboard/request/search")) return "Request — Search Items";
  if (pathname.startsWith("/dashboard/request/item")) return "Request — Item Details";
  if (pathname.startsWith("/dashboard/request")) return "Request — Project";
  if (pathname.startsWith("/dashboard/return/item")) return "Return — Item";
  if (pathname.startsWith("/dashboard/return")) return "Return";
  if (pathname.includes("/restock/item/") && pathname.includes("/edit")) return "Restock — Edit Item";
  if (pathname.startsWith("/dashboard/restock/project/add-new-stock")) return "Restock — New Inventory";
  if (pathname.startsWith("/dashboard/restock/project/add-new-fixture")) return "Restock — New Fixture";
  if (pathname.startsWith("/dashboard/restock/project/add-new")) return "Restock — Add New";
  if (pathname.startsWith("/dashboard/restock/items") || pathname.includes("/restock/item")) return "Restock — Select Item";
  if (pathname.startsWith("/dashboard/restock/test-area")) return "Restock — Test Area";
  if (pathname.startsWith("/dashboard/restock/project")) return "Restock — Project";
  if (pathname.startsWith("/dashboard/restock")) return "Restock";
  if (pathname.startsWith("/dashboard/alerts")) return "Low Stock Alerts";
  if (pathname.startsWith("/dashboard/reports/customized")) return "Reports — Customized";
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
  const branchText = (article.branches || [])
    .flatMap((b) => [b.label, b.description, ...(b.steps || [])])
    .join(" ");
  const sectionText = (article.sections || [])
    .flatMap((s) => [s.heading, ...(s.steps || [])])
    .join(" ");
  const haystack = [
    article.title,
    article.summary,
    ...(article.steps || []),
    sectionText,
    branchText,
    ...(article.keywords || []),
    ...(article.showProjects ? DEFAULT_PROJECTS : []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function getContextualArticles(pathname, role) {
  const routeMatches = HELP_ARTICLES.filter(
    (a) => articleMatchesRole(a, role) && articleMatchesRoute(a, pathname)
  );
  if (routeMatches.length) return routeMatches;

  // Restock sub-routes: suggest the matching restock guide
  if (pathname.includes("/restock/item/") && pathname.includes("/edit")) {
    return HELP_ARTICLES.filter((a) => a.id === "restock-edit-item" && articleMatchesRole(a, role));
  }
  if (pathname.startsWith("/dashboard/restock/project/add-new-stock")) {
    return HELP_ARTICLES.filter((a) => a.id === "restock-add-stock" && articleMatchesRole(a, role));
  }
  if (pathname.startsWith("/dashboard/restock/project/add-new-fixture")) {
    return HELP_ARTICLES.filter((a) => a.id === "restock-add-fixture" && articleMatchesRole(a, role));
  }

  return routeMatches;
}

export function searchHelpArticles(query, role) {
  return HELP_ARTICLES.filter(
    (a) => articleMatchesRole(a, role) && articleMatchesQuery(a, query)
  );
}

export function getWorkflowCards(role) {
  return WORKFLOW_CARDS.filter((w) => articleMatchesRole({ roles: w.roles }, role));
}

export function getArticlesByCategory(role) {
  const articles = HELP_ARTICLES.filter((a) => articleMatchesRole(a, role));
  const grouped = {};
  for (const article of articles) {
    const cat = article.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(article);
  }
  return grouped;
}

export function getSuggestedPrompts(pathname, role) {
  const cards = getWorkflowCards(role).map((c) => c.title);
  const contextual = getContextualArticles(pathname, role).map((a) => a.title);
  const seen = new Set();
  return [...cards, ...contextual]
    .filter((t) => {
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    })
    .slice(0, 6);
}
