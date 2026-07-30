import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { decodeToken } from "../utils/auth";
import {
  getContextualArticles,
  getPageContextLabel,
  getSuggestedPrompts,
  searchHelpArticles,
} from "../data/helpContent";

function getRole() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeToken(token);
  return payload?.role?.toLowerCase() || null;
}

export default function HelpAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);

  const role = getRole();
  const pageLabel = getPageContextLabel(location.pathname);

  const contextualArticles = useMemo(
    () => getContextualArticles(location.pathname, role),
    [location.pathname, role]
  );

  const listArticles = useMemo(() => {
    if (query.trim()) return searchHelpArticles(query, role);
    if (contextualArticles.length) return contextualArticles;
    return searchHelpArticles("", role);
  }, [query, role, contextualArticles]);

  const selectedArticle = useMemo(() => {
    if (!selectedId) return null;
    return searchHelpArticles("", role).find((a) => a.id === selectedId) || null;
  }, [selectedId, role]);

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
    setSelectedId(null);
    setQuery("");
    setMessages([]);
  }, [location.pathname]);

  const openArticle = (article) => {
    setSelectedId(article.id);
    setMessages((prev) => [
      ...prev,
      { type: "user", text: article.title },
      {
        type: "assistant",
        text: article.summary,
        articleId: article.id,
      },
    ]);
  };

  const handleAsk = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const matches = searchHelpArticles(trimmed, role);
    setQuery("");
    setMessages((prev) => [...prev, { type: "user", text: trimmed }]);

    if (matches.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          type: "assistant",
          text: "I could not find a specific guide for that. Try one of the topics below or browse all help articles.",
          suggestions: suggestedPrompts,
        },
      ]);
      setSelectedId(null);
      return;
    }

    const best = matches[0];
    setSelectedId(best.id);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAsk(query);
  };

  const goToLink = (path) => {
    setOpen(false);
    navigate(path);
  };

  const displayArticle = selectedArticle;

  return (
    <>
      {/* Floating help — bottom-right of main content area (standard FAB placement) */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white shadow-lg ring-4 ring-blue-600/20 hover:bg-blue-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        aria-expanded={open}
        aria-controls="mmis-help-panel"
        title="MMIS Help — ask how to request, return, restock, and more"
      >
        <span aria-hidden="true">?</span>
      </button>

      {open && (
        <div
          id="mmis-help-panel"
          ref={panelRef}
          role="dialog"
          aria-label="MMIS Help Assistant"
          className="fixed bottom-24 right-6 z-[100] flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
          style={{ maxHeight: "min(70vh, 32rem)" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-gray-200 bg-blue-600 px-4 py-3 text-white dark:border-gray-700">
            <div>
              <p className="text-sm font-bold">MMIS Help Assistant</p>
              <p className="text-xs text-blue-100">
                You are on: {pageLabel}
                {role ? ` · ${role}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-blue-100 hover:bg-blue-700 hover:text-white"
              aria-label="Close help"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            {/* Chat history */}
            {messages.length > 0 && (
              <div className="mb-3 space-y-2">
                {messages.map((msg, idx) => (
                  <div
                    key={`${msg.type}-${idx}`}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.type === "user"
                        ? "ml-6 bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100"
                        : "mr-4 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
                    }`}
                  >
                    {msg.text}
                    {msg.relatedCount > 0 && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        +{msg.relatedCount} related topic(s) in search results
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Selected guide detail */}
            {displayArticle && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {displayArticle.title}
                </h3>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {displayArticle.summary}
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-gray-700 dark:text-gray-200">
                  {displayArticle.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                {displayArticle.links?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {displayArticle.links.map((link) => (
                      <button
                        key={link.path}
                        type="button"
                        onClick={() => goToLink(link.path)}
                        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        {link.label} →
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                  }}
                  className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  ← Back to topics
                </button>
              </div>
            )}

            {/* Quick prompts — hide when viewing full article detail in isolation */}
            {!displayArticle && (
              <>
                <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {contextualArticles.length
                    ? "Suggested for this page"
                    : "Popular topics"}
                </p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        const article = searchHelpArticles(prompt, role)[0];
                        if (article) openArticle(article);
                        else handleAsk(prompt);
                      }}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-blue-500"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {query ? "Search results" : "Browse guides"}
                </p>
                <ul className="space-y-1">
                  {listArticles.slice(0, 8).map((article) => (
                    <li key={article.id}>
                      <button
                        type="button"
                        onClick={() => openArticle(article)}
                        className="w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <span className="font-medium">{article.title}</span>
                        <span className="mt-0.5 block truncate text-gray-500 dark:text-gray-400">
                          {article.summary}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-200 p-3 dark:border-gray-700"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask how to request, return, upload..."
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Ask
              </button>
            </div>
            <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
              Guides are based on MMIS workflows. For live stock counts, use Request or Reports.{" "}
              <Link
                to="/dashboard/documents"
                onClick={() => setOpen(false)}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                View SOPs
              </Link>
            </p>
          </form>
        </div>
      )}
    </>
  );
}
