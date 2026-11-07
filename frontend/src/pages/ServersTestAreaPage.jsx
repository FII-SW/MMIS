import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import {
  SERVER_AREA_HINTS,
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

      <div className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        <p className="mb-0.5 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
          Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
        </p>
        <p className="mb-1 text-center text-base font-semibold text-gray-800 dark:text-gray-100">
          Which FBT line?
        </p>
        <p className="mb-5 text-center text-xs text-gray-500 dark:text-gray-400">
          Servers are only tracked for FBT Mobo and FBT Agora.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SERVER_TEST_AREAS.map((area) => {
            const n = counts[area] || 0;
            return (
              <button
                type="button"
                key={area}
                onClick={() => navigate(serversListUrl(project, area))}
                className="group flex min-h-[7rem] flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600"
              >
                <div>
                  <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    {serverAreaLabel(area)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                    {SERVER_AREA_HINTS[area]}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400 dark:text-gray-500">
                    {area}
                  </p>
                </div>
                <div className="mt-4 flex w-full items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      n > 0
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                        : "bg-slate-100 text-slate-500 dark:bg-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {loading ? "…" : n > 0 ? `${n} server${n === 1 ? "" : "s"}` : "Empty"}
                  </span>
                  <span className="text-xs font-semibold text-blue-600 group-hover:underline dark:text-blue-400">
                    Open →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
