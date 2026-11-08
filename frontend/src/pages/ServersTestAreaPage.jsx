import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import {
  SERVER_TEST_AREAS,
  SERVERS_BASE,
  SERVERS_TITLE,
  serverAreaLabel,
  serversListUrl,
} from "../utils/servers";

export default function ServersTestAreaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const project = params.get("project");
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project) {
      navigate(SERVERS_BASE, { replace: true });
      return;
    }
    setLoading(true);
    API.get("/servers/", { params: { project } })
      .then((res) => {
        const next = {};
        (res.data || []).forEach((row) => {
          const area = row.test_area || "";
          next[area] = (next[area] || 0) + 1;
        });
        setCounts(next);
      })
      .catch(() => setCounts({}))
      .finally(() => setLoading(false));
  }, [project, navigate]);

  if (!project) return null;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <PageHeaderWithBack title={SERVERS_TITLE} onBack={() => navigate(SERVERS_BASE)} />

      <div className="mx-auto max-w-2xl px-4 pb-8 sm:px-6">
        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-gray-200">
          <span className="text-blue-600 dark:text-blue-400">{project}</span>
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SERVER_TEST_AREAS.map((area) => {
            const n = counts[area] || 0;
            return (
              <button
                type="button"
                key={area}
                onClick={() => navigate(serversListUrl(project, area))}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
              >
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  {serverAreaLabel(area)}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                    n > 0
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                      : "bg-slate-100 text-slate-400 dark:bg-gray-700 dark:text-gray-500"
                  }`}
                >
                  {loading ? "…" : n}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
