import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api";
import Header from "../components/Header";
import PageHeaderWithBack from "../components/PageHeaderWithBack";
import { decodeToken } from "../utils/auth";

export default function ReturnItemPage() {
  const { transaction_id } = useParams();
  const navigate = useNavigate();

  const [tx, setTx] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [employeeId, setEmployeeId] = useState(null);
  const [quantityError, setQuantityError] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);

  // Load token info
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const payload = decodeToken(token);
    if (payload?.employee_id) {
      setEmployeeId(payload.employee_id);
    }
  }, []);

  // Load transaction details
  useEffect(() => {
    API.get(`/transactions/${transaction_id}`)
      .then((res) => setTx(res.data))
      .catch((err) => console.error("Error loading transaction details:", err));
  }, [transaction_id]);

  const handleQuantityChange = (e) => {
    const value = e.target.value;
    const numValue = parseFloat(value);
    // Use remaining_quantity if available, otherwise fall back to quantity_used
    const maxQuantity = tx ? (tx.remaining_quantity !== undefined ? tx.remaining_quantity : tx.quantity_used) : 0;

    if (value === "") {
      setQuantity("");
      setQuantityError("");
      return;
    }

    if (isNaN(numValue) || numValue <= 0) {
      setQuantityError("Quantity must be greater than 0");
      setQuantity(value);
      return;
    }

    if (numValue > maxQuantity) {
      setQuantityError(`Cannot return more than ${maxQuantity} (quantity taken)`);
      setQuantity(value); // Allow typing but show error
      return;
    }

    setQuantity(value);
    setQuantityError("");
  };

  const handleQuantityBlur = (e) => {
    const value = e.target.value;
    const numValue = parseFloat(value);
    // Use remaining_quantity if available, otherwise fall back to quantity_used
    const maxQuantity = tx ? (tx.remaining_quantity !== undefined ? tx.remaining_quantity : tx.quantity_used) : 0;

    // Clamp value to max when user leaves the field
    if (value && numValue > maxQuantity) {
      setQuantity(maxQuantity.toString());
      setQuantityError("");
    }
  };

  const submitReturn = async () => {
    if (!employeeId) {
      alert("Session expired. Please log in again.");
      return;
    }
    if (!quantity) {
      alert("Enter return quantity");
      return;
    }

    const numQuantity = parseFloat(quantity);
    // Use remaining_quantity if available, otherwise fall back to quantity_used
    const maxQuantity = tx ? (tx.remaining_quantity !== undefined ? tx.remaining_quantity : tx.quantity_used) : 0;

    if (isNaN(numQuantity) || numQuantity <= 0) {
      alert("Please enter a valid quantity greater than 0");
      return;
    }

    if (numQuantity > maxQuantity) {
      alert(`Cannot return more than ${maxQuantity} items. You only took ${maxQuantity} items.`);
      return;
    }

    try {
      await API.post(`/transactions/return?request_transaction_id=${tx.transaction_id}`, {
        item_id: tx.item_id,
        employee_id: employeeId,
        fixture_id: tx.fixture_id,
        quantity_used: Number(quantity),
        remarks: remarks || null,
        transaction_type: "return",
        test_area: tx.test_area,
        project_name: tx.project_name,
      });

      alert("Return successful!");
      navigate("/dashboard/return/");

    } catch (err) {
      console.error(err);
      alert("Return failed");
    }
  };

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

  if (!tx) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col">
        <Header />
        <PageHeaderWithBack title="Return Item" onBack={() => navigate("/dashboard/return/")} />
        <h2 className="text-center mt-10 text-gray-500 dark:text-gray-400">Loading...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <Header />

      <PageHeaderWithBack title="Return Item" onBack={() => navigate("/dashboard/return/")} />

      {/* Main content - fills remaining screen */}
      <div className="flex-1 flex flex-col justify-center max-w-5xl w-full mx-auto px-6 py-4">
        {/* ITEM CARD */}
        <div className="bg-white border rounded-xl shadow-md p-5 mb-4">
          <div className="flex gap-6 items-center">
            {/* Item Image */}
            <div className="flex-shrink-0 relative">
              {getImageUrl(tx.item_image_url) ? (
                <div className="relative group">
                  <img 
                    src={getImageUrl(tx.item_image_url)} 
                    alt={tx.item_name || `Item #${tx.item_id}`}
                    className="w-44 h-44 object-contain rounded-xl border-2 border-gray-200 shadow bg-white p-2 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                    onClick={() => setShowImageModal(true)}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  {/* Zoom indicator */}
                  <div className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-1">Click to enlarge</p>
                </div>
              ) : null}
              <div 
                className="w-44 h-44 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm"
                style={{ display: getImageUrl(tx.item_image_url) ? 'none' : 'flex' }}
              >
                No Image
              </div>
            </div>
            
            {/* Item Details */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">{tx.item_name || `Item #${tx.item_id}`}</h2>
              <div className="space-y-2 text-base">
                <p className="text-gray-700"><span className="font-semibold text-gray-900">Description:</span> {tx.item_description || "N/A"}</p>
                <p className="text-gray-700"><span className="font-semibold text-gray-900">Part Number:</span> {tx.item_part_number || "N/A"}</p>
                <p className="text-gray-700"><span className="font-semibold text-gray-900">Manufacturer:</span> {tx.item_manufacturer || "N/A"}</p>
                <p className="text-gray-700"><span className="font-semibold text-gray-900">Fixture:</span> {tx.fixture_name || "N/A"}</p>
                <p className="text-gray-700"><span className="font-semibold text-gray-900">Quantity Taken:</span> {tx.quantity_used}</p>
                {tx.remaining_quantity !== undefined && tx.remaining_quantity !== tx.quantity_used && (
                  <p className="text-orange-600 font-bold">Remaining to Return: {tx.remaining_quantity}</p>
                )}
                <p className="text-gray-500"><span className="font-semibold">Date Requested:</span> {tx.created_at.substring(0, 10)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* FORM */}
        <div className="bg-white border rounded-xl shadow-md p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Return Quantity</label>
              <input
                type="number"
                min="1"
                max={tx.remaining_quantity !== undefined ? tx.remaining_quantity : tx.quantity_used}
                step="1"
                className={`w-full border-2 p-2.5 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white transition-all hover:border-blue-300 ${quantityError ? "border-red-500" : "border-gray-300 dark:border-gray-600"}`}
                value={quantity}
                onChange={handleQuantityChange}
                onBlur={handleQuantityBlur}
                placeholder={`Enter quantity (max ${tx.remaining_quantity !== undefined ? tx.remaining_quantity : tx.quantity_used})`}
              />
              {quantityError ? (
                <p className="text-red-500 text-xs mt-1">{quantityError}</p>
              ) : (
                <p className="text-gray-500 text-xs mt-1">Maximum returnable: {tx.quantity_used}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Remarks (Optional)</label>
              <input
                type="text"
                className="w-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white p-2.5 rounded-lg text-sm transition-all hover:border-blue-300"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any notes..."
              />
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-5">
            <button
              className="px-8 py-2.5 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-medium transition-colors"
              onClick={() => navigate("/dashboard/return/")}
            >
              Back
            </button>
            <button
              className="px-8 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow transition-colors"
              onClick={submitReturn}
            >
              Submit Return
            </button>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && getImageUrl(tx.item_image_url) && (
        <div 
          className="fixed inset-0 bg-black/80 dark:bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors z-10 shadow-lg"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img 
              src={getImageUrl(tx.item_image_url)} 
              alt={tx.item_name || `Item #${tx.item_id}`}
              className="w-full h-full object-contain rounded-lg bg-white dark:bg-gray-800 p-4"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center mt-4 text-lg font-semibold">{tx.item_name || `Item #${tx.item_id}`}</p>
          </div>
        </div>
      )}

    </div>
  );
}
