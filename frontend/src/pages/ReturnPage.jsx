import { useEffect, useState } from "react";
import API from "../api";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { decodeToken } from "../utils/auth";

export default function ReturnPage() {
  const [transactions, setTransactions] = useState([]);
  const [employeeId, setEmployeeId] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Load employee info
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const payload = decodeToken(token);
    if (payload?.employee_id) {
      setEmployeeId(payload.employee_id);
    }
  }, []);

  // Fetch user's active transactions
  const fetchTransactions = () => {
    if (!employeeId) return;

    API.get(`/transactions/user/${employeeId}`)
      .then((res) => {
        setTransactions(res.data);
      })
      .catch((err) => console.error("Error fetching transactions:", err));
  };

  useEffect(() => {
    fetchTransactions();
  }, [employeeId, location.pathname]); // Refetch when location changes (e.g., navigating back)

  // Helper function to get full image URL
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    // If it's already a full URL, return as is
    if (imageUrl.startsWith('http')) return imageUrl;
    // Get API base URL (same logic as api.js)
    const apiBaseUrl = import.meta.env.VITE_API_URL || 
      (import.meta.env.PROD ? '/api' : 'http://127.0.0.1:8000');
    // Prepend the API base URL
    return `${apiBaseUrl}${imageUrl}`;
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors">
      <Header />

      <PageHeaderWithBack title="Return" onBack={() => navigate("/dashboard")} />

      <div className="max-w-xl mx-auto px-4">

        <h2 className="text-xl font-semibold mb-6 text-gray-700 dark:text-gray-300">
          Select an Item to Return
        </h2>

        {/* NO TRANSACTIONS */}
        {transactions.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400">
            You have no active items to return.
          </p>
        )}

        {/* SHOW USER'S ACTIVE TRANSACTIONS */}
        <div className="flex flex-col gap-4">
          {transactions.map((tx) => (
            <div
              key={tx.transaction_id}
              onClick={() => navigate(`/dashboard/return/item/${tx.transaction_id}`)}
              className="p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl shadow cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-4"
            >
              {/* Item Image */}
              {getImageUrl(tx.item_image_url) ? (
                <div className="flex-shrink-0">
                  <img 
                    src={getImageUrl(tx.item_image_url)} 
                    alt={tx.item_name || `Item #${tx.item_id}`}
                    className="w-20 h-20 object-cover rounded border dark:border-gray-600"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="flex-shrink-0 w-20 h-20 bg-gray-200 dark:bg-gray-600 rounded border dark:border-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                  No Image
                </div>
              )}
              
              {/* Item Details */}
              <div className="flex-1">
                <div className="font-semibold text-lg text-gray-800 dark:text-gray-200">{tx.item_name || `Item #${tx.item_id}`}</div>

                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  {tx.remaining_quantity !== undefined && tx.remaining_quantity !== tx.quantity_used ? (
                    <>
                      <span className="font-semibold">Remaining to Return: {tx.remaining_quantity}</span>
                      <span className="text-gray-500 dark:text-gray-500 ml-2">(of {tx.quantity_used} requested)</span>
                    </>
                  ) : (
                    <span>Quantity: {tx.quantity_used}</span>
                  )}
                </div>

                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  Requested on: {tx.created_at.substring(0, 10)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
