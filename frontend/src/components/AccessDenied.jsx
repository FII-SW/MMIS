import { useNavigate } from "react-router-dom";
import Header from "./Header";
import PageHeaderWithBack from "./PageHeaderWithBack";

export default function AccessDenied({
  feature = "this feature",
  title = "Access Denied",
  backTo = "/dashboard",
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />
      <PageHeaderWithBack title={title} onBack={() => navigate(backTo)} />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 max-w-md text-center border border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You need admin access level to use {feature}.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Please contact your administrator if you believe you should have access.
          </p>
        </div>
      </div>
    </div>
  );
}
