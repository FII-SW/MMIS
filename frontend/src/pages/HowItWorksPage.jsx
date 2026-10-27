import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { FLOW_GROUPS, USER_FLOWS } from "../data/userFlows";
import { isAdminUser, isViewerUser } from "../utils/auth";

function canOpen(who) {
  if (who === "everyone") return true;
  if (isViewerUser()) return false;
  if (who === "admin") return isAdminUser();
  return true;
}

function whoTone(who) {
  if (who === "admin") return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
  if (who === "everyone") return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
  return "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100";
}

function groupTone(groupId) {
  if (groupId === "fixtures") return "bg-teal-600";
  if (groupId === "lookup") return "bg-indigo-600";
  return "bg-blue-600";
}

function FlowSteps({ steps, accent }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={`${index}-${step.title}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${accent}`}
              >
                {index + 1}
              </span>
              {!last && <span className="my-1 w-0.5 flex-1 min-h-[1.25rem] bg-blue-200 dark:bg-blue-900" />}
            </div>
            <div className={last ? "pt-1.5 pb-1" : "pb-5 pt-1.5"}>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function HowItWorksPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const detailRef = useRef(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return USER_FLOWS;
    return USER_FLOWS.filter((flow) =>
      [flow.title, flow.summary, flow.whoLabel, flow.note, ...flow.steps.flatMap((step) => [step.title, step.detail])]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(q))
    );
  }, [query]);

  const selected = matches.find((flow) => flow.id === params.get("flow")) || matches[0] || null;
  const selectedGroup = FLOW_GROUPS.find((group) => group.id === selected?.group);

  const choose = (id, scrollDetail = false) => {
    const next = new URLSearchParams(params);
    next.set("flow", id);
    setParams(next, { replace: true });
    if (scrollDetail && detailRef.current && window.matchMedia("(max-width: 1023px)").matches) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <PageHeaderWithBack title="How it works" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-6xl px-2 pb-10 sm:px-4">
        <div className="mb-5 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Pick a task. Follow the numbered steps. Use Open this page when you are ready to do it.
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {USER_FLOWS.length} guides · Stock, Fixtures, and Look up
          </p>
        </div>

        <div className="relative mb-5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, for example restock, overdue, transfer, or report"
            aria-label="Search flows"
            className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-4 pr-24 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear
            </button>
          )}
        </div>

        {!query && (
          <div className="mb-5 flex flex-wrap justify-center gap-2">
            {FLOW_GROUPS.map((group) => {
              const count = USER_FLOWS.filter((flow) => flow.group === group.id).length;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    const first = USER_FLOWS.find((flow) => flow.group === group.id);
                    if (first) choose(first.id, true);
                  }}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  <span className="block text-xs font-bold text-gray-800 dark:text-gray-100">
                    {group.label}
                    <span className="ml-1 font-semibold text-gray-500 dark:text-gray-400">({count})</span>
                  </span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">{group.hint}</span>
                </button>
              );
            })}
          </div>
        )}

        {matches.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            No guide matches &quot;{query}&quot;. Try restock, fixture, overdue, or report.
          </p>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-3 lg:sticky lg:top-3 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {matches.map((flow) => {
                  const active = selected?.id === flow.id;
                  return (
                    <button
                      key={`mobile-${flow.id}`}
                      type="button"
                      onClick={() => choose(flow.id, true)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-blue-600 text-white"
                          : "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {flow.title}
                    </button>
                  );
                })}
              </div>

              <div className="hidden space-y-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:block">
                {FLOW_GROUPS.map((group) => {
                  const flows = matches.filter((flow) => flow.group === group.id);
                  if (flows.length === 0) return null;
                  return (
                    <div key={group.id}>
                      <div className="mb-1.5 flex items-end justify-between gap-2 px-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {group.label}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">{group.hint}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-gray-400">{flows.length}</span>
                      </div>
                      <div className="space-y-1">
                        {flows.map((flow) => {
                          const active = selected?.id === flow.id;
                          return (
                            <button
                              key={flow.id}
                              type="button"
                              onClick={() => choose(flow.id)}
                              aria-current={active ? "true" : undefined}
                              className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                                active
                                  ? "bg-blue-600 text-white shadow"
                                  : "text-gray-800 hover:bg-blue-50 dark:text-gray-100 dark:hover:bg-gray-700"
                              }`}
                            >
                              <span className="block text-sm font-semibold leading-snug">{flow.title}</span>
                              <span
                                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  active ? "bg-white/20 text-white" : whoTone(flow.who)
                                }`}
                              >
                                {flow.whoLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            {selected && (
              <article
                ref={detailRef}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6"
              >
                <div className="mb-5 flex flex-col gap-3 border-b border-gray-100 pb-5 dark:border-gray-700 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {selectedGroup?.label || "Guide"} · {selected.steps.length} steps
                    </p>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.title}</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{selected.summary}</p>
                    <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${whoTone(selected.who)}`}>
                      {selected.whoLabel}
                    </span>
                  </div>
                  {canOpen(selected.who) ? (
                    <button
                      type="button"
                      onClick={() => navigate(selected.path)}
                      className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Open this page
                    </button>
                  ) : (
                    <p className="max-w-xs rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                      Your account can read this guide. Ask an admin if you need to do the task.
                    </p>
                  )}
                </div>

                <FlowSteps steps={selected.steps} accent={groupTone(selected.group)} />

                {selected.note && (
                  <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                    <span className="font-semibold">Note. </span>
                    {selected.note}
                  </p>
                )}

                <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-green-200">
                    When you finish
                  </p>
                  <p className="mt-1 text-sm font-medium text-green-900 dark:text-green-100">{selected.outcome}</p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
                  <button
                    type="button"
                    disabled={matches.indexOf(selected) <= 0}
                    onClick={() => {
                      const index = matches.indexOf(selected);
                      if (index > 0) choose(matches[index - 1].id, true);
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Previous guide
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {matches.indexOf(selected) + 1} of {matches.length}
                  </span>
                  <button
                    type="button"
                    disabled={matches.indexOf(selected) >= matches.length - 1}
                    onClick={() => {
                      const index = matches.indexOf(selected);
                      if (index < matches.length - 1) choose(matches[index + 1].id, true);
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Next guide
                  </button>
                </div>
              </article>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
