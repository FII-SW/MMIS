import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { decodeToken } from "../utils/auth";
import { recordHelpFeedback } from "../utils/helpFeedback";
import {
  getAllProjects,
  getArticleById,
  getArticlesByCategory,
  getContextualArticles,
  getPageContextLabel,
  getProjectsWithoutTestArea,
  getSuggestedPrompts,
  getTestAreaList,
  getWorkflowCards,
  searchHelpArticles,
} from "../data/helpContent";

function getRole() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeToken(token);
  return payload?.role?.toLowerCase() || null;
}

const WORKFLOW_COLORS = {
  blue: "border-blue-200 bg-blue-50 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:hover:bg-blue-900/50",
  green: "border-green-200 bg-green-50 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:hover:bg-green-900/50",
  amber: "border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:hover:bg-amber-900/50",
  purple: "border-purple-200 bg-purple-50 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/30 dark:hover:bg-purple-900/50",
};

function StepList({ steps, ordered = true }) {
  const Tag = ordered ? "ol" : "ul";
  const listClass = ordered ? "list-decimal" : "list-disc";
  return (
    <Tag className={`${listClass} space-y-1.5 pl-4 text-xs leading-relaxed text-gray-700 dark:text-gray-200`}>
      {steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </Tag>
  );
}

function ProjectChips() {
  const [projects, setProjects] = useState(getAllProjects);

  useEffect(() => {
    const refresh = () => setProjects(getAllProjects());
    window.addEventListener("projectsUpdated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("projectsUpdated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const noTestArea = getProjectsWithoutTestArea();
  return (
    <div className="mt-2 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        All projects ({projects.length})
      </p>
      <div className="flex flex-wrap gap-1">
        {projects.map((p) => (
          <span
            key={p}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              noTestArea.includes(p)
                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            }`}
            title={noTestArea.includes(p) ? "No test area required" : "Test area required"}
          >
            {p}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-purple-600 dark:text-purple-300">
        Purple = no test area ({noTestArea.join(", ")})
      </p>
    </div>
  );
}

function TestAreaChips() {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Common test areas
      </p>
      <div className="flex flex-wrap gap-1">
        {getTestAreaList().map((ta) => (
          <span
            key={ta}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
          >
            {ta}
          </span>
        ))}
      </div>
    </div>
  );
}

function GuideDetail({ article, selectedBranchId, onSelectBranch, onBack, onNavigate }) {
  const branch = article.branches?.find((b) => b.id === selectedBranchId);
  const [feedbackSent, setFeedbackSent] = useState(null);

  const sendFeedback = (helpful) => {
    recordHelpFeedback(article.id, helpful);
    setFeedbackSent(helpful ? "yes" : "no");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        {article.icon && <span className="text-lg">{article.icon}</span>}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{article.title}</h3>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{article.summary}</p>
        </div>
      </div>

      {/* Restock branch picker */}
      {article.branches && !selectedBranchId && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            What do you need to do?
          </p>
          {article.branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelectBranch(b.id)}
              className="w-full rounded-lg border border-amber-200 bg-white p-3 text-left transition hover:border-amber-400 hover:bg-amber-50 dark:border-amber-800 dark:bg-gray-800 dark:hover:bg-amber-900/20"
            >
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{b.label}</p>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{b.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Branch steps */}
      {branch && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="mb-2 text-xs font-bold text-amber-900 dark:text-amber-100">{branch.label}</p>
          <StepList steps={branch.steps} />
          {branch.links?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {branch.links.map((link) => (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => onNavigate(link.path)}
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  {link.label} →
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      {!article.branches && article.sections?.map((section, idx) => (
        <div key={idx} className="rounded-lg border border-gray-200 bg-white/80 p-3 dark:border-gray-600 dark:bg-gray-800/80">
          {section.heading && (
            <p className="mb-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">{section.heading}</p>
          )}
          <StepList steps={section.steps} />
        </div>
      ))}

      {/* Flat steps fallback */}
      {!article.branches && !article.sections && article.steps && (
        <StepList steps={article.steps} />
      )}

      {article.showProjects && <ProjectChips />}
      {article.showTestAreas && <TestAreaChips />}

      {article.links?.length > 0 && !article.branches && (
        <div className="flex flex-wrap gap-2">
          {article.links.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => onNavigate(link.path)}
              className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {link.label} →
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-lg border border-gray-200 bg-white/60 p-2 dark:border-gray-600 dark:bg-gray-800/60">
        <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">Was this helpful?</p>
        {feedbackSent ? (
          <p className="mt-1 text-[11px] text-green-700 dark:text-green-300">
            Thanks for your feedback!
          </p>
        ) : (
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => sendFeedback(true)}
              className="rounded-md border border-green-300 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-800 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200"
            >
              👍 Yes
            </button>
            <button
              type="button"
              onClick={() => sendFeedback(false)}
              className="rounded-md border border-gray-300 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              👎 No
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back
      </button>
    </div>
  );
}

export default function HelpAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState("home");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [messages, setMessages] = useState([]);

  const role = getRole();
  const pageLabel = getPageContextLabel(location.pathname);

  const workflowCards = useMemo(() => getWorkflowCards(role), [role]);
  const categorized = useMemo(() => getArticlesByCategory(role), [role]);
  const contextualArticles = useMemo(
    () => getContextualArticles(location.pathname, role),
    [location.pathname, role]
  );

  const selectedArticle = useMemo(
    () => (selectedId ? getArticleById(selectedId, role) : null),
    [selectedId, role]
  );

  const listArticles = useMemo(() => {
    if (query.trim()) return searchHelpArticles(query, role);
    if (view === "browse") return searchHelpArticles("", role);
    return contextualArticles.length ? contextualArticles : searchHelpArticles("", role);
  }, [query, role, contextualArticles, view]);

  const suggestedPrompts = useMemo(
    () => getSuggestedPrompts(location.pathname, role),
    [location.pathname, role]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    setView("home");
    setSelectedId(null);
    setSelectedBranchId(null);
    setQuery("");
    setMessages([]);
  }, [location.pathname]);

  const resetToHome = () => {
    setView("home");
    setSelectedId(null);
    setSelectedBranchId(null);
  };

  const openArticle = (articleId) => {
    const article = getArticleById(articleId, role);
    if (!article) return;
    setSelectedId(articleId);
    setSelectedBranchId(null);
    setView("guide");
    setMessages((prev) => [
      ...prev,
      { type: "user", text: article.title },
      { type: "assistant", text: article.summary, articleId: article.id },
    ]);
  };

  const openWorkflow = (card) => {
    openArticle(card.articleId);
  };

  const handleAsk = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const matches = searchHelpArticles(trimmed, role);
    setQuery("");
    setMessages((prev) => [...prev, { type: "user", text: trimmed }]);

    if (matches.length === 0) {
      setView("home");
      setSelectedId(null);
      setMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          text: "No exact match found. Try a workflow below or browse all guides.",
        },
      ]);
      return;
    }

    const best = matches[0];
    setSelectedId(best.id);
    setSelectedBranchId(null);
    setView("guide");
    setMessages((prev) => [
      ...prev,
      {
        type: "assistant",
        text: best.summary,
        articleId: best.id,
        relatedCount: matches.length > 1 ? matches.length - 1 : 0,
      },
    ]);
  };

  const goToLink = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white shadow-lg ring-4 ring-blue-600/20 hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        aria-expanded={open}
        aria-controls="mmis-help-panel"
        title="MMIS Help"
      >
        <span aria-hidden="true">?</span>
      </button>

      {open && (
        <div
          id="mmis-help-panel"
          role="dialog"
          aria-label="MMIS Help Assistant"
          className="fixed bottom-24 right-6 z-[100] flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-[min(100vw-2rem,26rem)] dark:border-gray-700 dark:bg-gray-800"
          style={{ maxHeight: "min(78vh, 36rem)" }}
        >
          {/* Header */}
          <div className="shrink-0 border-b border-blue-700 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold">MMIS Help Assistant</p>
                <p className="text-[11px] text-blue-100">
                  {pageLabel}{role ? ` · ${role}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-blue-100 hover:bg-blue-800"
                aria-label="Close help"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-2 flex gap-1">
              {[
                { id: "home", label: "Home" },
                { id: "browse", label: "All Guides" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setView(tab.id);
                    setSelectedId(null);
                    setSelectedBranchId(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    view === tab.id || (view === "guide" && tab.id === "home")
                      ? "bg-white text-blue-700"
                      : "bg-blue-500/40 text-white hover:bg-blue-500/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {messages.length > 0 && view === "guide" && (
              <div className="mb-3 max-h-24 space-y-1.5 overflow-y-auto">
                {messages.slice(-3).map((msg, idx) => (
                  <div
                    key={`${msg.type}-${idx}`}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                      msg.type === "user"
                        ? "ml-4 bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100"
                        : "mr-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}
              </div>
            )}

            {/* Guide detail view */}
            {view === "guide" && selectedArticle && (
              <GuideDetail
                article={selectedArticle}
                selectedBranchId={selectedBranchId}
                onSelectBranch={setSelectedBranchId}
                onBack={resetToHome}
                onNavigate={goToLink}
              />
            )}

            {/* Home — workflow cards */}
            {view === "home" && !selectedArticle && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  What do you need help with?
                </p>
                <div className="space-y-2">
                  {workflowCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => openWorkflow(card)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${WORKFLOW_COLORS[card.color]}`}
                    >
                      <span className="text-2xl">{card.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{card.title}</p>
                        <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-300">{card.description}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {contextualArticles.length > 0 && (
                  <>
                    <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      For this page
                    </p>
                    <div className="space-y-1">
                      {contextualArticles.slice(0, 3).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => openArticle(a.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <span>{a.icon}</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{a.title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => openArticle("view-sops")}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left text-xs text-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-blue-900/20"
                >
                  <span>📄</span>
                  <span>Browse SOPs and project documents</span>
                </button>

                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Quick ask</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        const match = searchHelpArticles(prompt, role)[0];
                        if (match) openArticle(match.id);
                        else handleAsk(prompt);
                      }}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Browse all guides */}
            {view === "browse" && !selectedArticle && (
              <div className="space-y-3">
                {Object.entries(categorized).map(([category, articles]) => (
                  <div key={category}>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {category}
                    </p>
                    <ul className="space-y-0.5">
                      {articles.map((article) => (
                        <li key={article.id}>
                          <button
                            type="button"
                            onClick={() => openArticle(article.id)}
                            className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <span className="text-sm">{article.icon || "📘"}</span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                                {article.title}
                              </p>
                              <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                                {article.summary}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Search results inline when typing in footer */}
            {query.trim() && view !== "guide" && (
              <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                <p className="mb-1 text-[11px] font-semibold text-gray-500">Search results</p>
                <ul className="space-y-0.5">
                  {listArticles.slice(0, 6).map((article) => (
                    <li key={article.id}>
                      <button
                        type="button"
                        onClick={() => openArticle(article.id)}
                        className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {article.icon} {article.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer search */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(query);
            }}
            className="shrink-0 border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search: request, return, restock, project..."
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Ask
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              MMIS workflow guides ·{" "}
              <Link to="/dashboard/documents" onClick={() => setOpen(false)} className="text-blue-600 hover:underline dark:text-blue-400">
                View SOPs
              </Link>
            </p>
          </form>
        </div>
      )}
    </>
  );
}
