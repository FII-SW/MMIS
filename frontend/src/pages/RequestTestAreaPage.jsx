import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { DEFAULT_TEST_AREAS } from "../utils/testAreas";

export default function RequestTestAreaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const project = params.get("project");

  const testAreas = DEFAULT_TEST_AREAS;

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Request" onBack={() => navigate("/dashboard/request")} />

      {/* SUBTITLE */}
      <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-2 text-lg">
        Project: <span className="text-blue-600 dark:text-blue-400">{project}</span>
      </p>

      <p className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-6 text-lg">
        Select Test Area
      </p>

      {/* TEST AREA GRID */}
      <div className="grid grid-cols-3 gap-6 justify-center mx-auto max-w-4xl">
        {testAreas.map((area) => (
          <div
            key={area}
            onClick={() =>
              navigate(`/dashboard/request/search?project=${project}&test_area=${area}`)
            }
            className="border dark:border-gray-700 p-8 text-center rounded-xl bg-white dark:bg-gray-800 cursor-pointer 
                       hover:bg-blue-100 dark:hover:bg-gray-700 hover:shadow-lg transition-all shadow-md"
          >
            <span className="font-semibold text-gray-800 dark:text-gray-200 text-lg">{area}</span>
          </div>
        ))}
      </div>
    </div>
  );
}