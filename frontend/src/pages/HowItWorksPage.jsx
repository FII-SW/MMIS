import { useMemo, useState } from "react";
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

function FlowSteps({ steps, accent }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.title} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${accent}`}>
                {index + 1}
              </span>
              {!last && <span className="my-1 w-0.5 flex-1 bg-blue-200 dark:bg-blue-900" />}
            </div>
            <div className={last ? "pt-1" : "pb-5 pt-1"}>
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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return USER_FLOWS;
    return USER_FLOWS.filter((flow) =>
      [flow.title, flow.summary, flow.whoLabel, ...flow.steps.flatMap((step) => [step.title, step.detail]), flow.note]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(q))
    );
  }, [query]);

  const selected = matches.find((flow) => flow.id === params.get("flow")) || matches[0];

  const choose = (id) => {
    const next = new URLSearchParams(params);
    next.set("flow", id);
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-transparent">
      <PageHeaderWithBack title="How it works" onBack={() => navigate("/dashboard")} />

      <div className="mx-auto max-w-6xl px-2 pb-10">
        <p className="mb-4 text-center text-sm text-gray-600 dark:text-gray-300">
          Pick a task. Follow the steps from top to bottom.
        </p>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, for example restock, fixture, or report"
          aria-label="Search flows"
          className="mb-5 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />

        {matches.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            No flow matches &quot;{query}&quot;.
          </p>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              {FLOW_GROUPS.map((group) => {
                const flows = matches.filter((flow) => flow.group === group.id);
                if (flows.length === 0) return null;
                return (
                  <div key={group.id}>
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {group.label}
                    </p>
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
                            <span className="block text-sm font-semibold">{flow.title}</span>
                            <span className={`mt-0.5 block text-xs ${active ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}>
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

            {selected && (
              <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.title}</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{selected.summary}</p>
                    <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      {selected.whoLabel}
                    </span>
                  </div>
                  {canOpen(selected.who) ? (
                    <button
                      type="button"
                      onClick={() => navigate(selected.path)}
                      className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Open this page
                    </button>
                  ) : (
                    <p className="max-w-xs text-xs text-gray-500 dark:text-gray-400">
                      Your account can view this flow. Ask an admin if you need to do it.
                    </p>
                  )}
                </div>

                <FlowSteps steps={selected.steps} accent="bg-blue-600" />

                {selected.note && (
                  <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                    {selected.note}
                  </p>
                )}

                <p className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
                  {selected.outcome}
                </p>
              </article>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
