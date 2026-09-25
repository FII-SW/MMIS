import { useEffect, useState } from "react";
import API from "../api";

const DEFAULT_INPUT_CLASS =
  "w-full p-3 border dark:border-gray-600 dark:bg-gray-700 dark:text-white border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors";
const DEFAULT_LABEL_CLASS = "block mb-2 font-semibold text-gray-700 dark:text-gray-300";

export function useFixtureDescriptorOptions() {
  const [options, setOptions] = useState({ manufacturers: [], production_lines: [] });
  useEffect(() => {
    API.get("/fixtures/descriptor-options")
      .then((res) => setOptions({
        manufacturers: res.data?.manufacturers || [],
        production_lines: res.data?.production_lines || [],
      }))
      .catch(() => {});
  }, []);
  return options;
}

export default function FixtureDescriptorFields({
  manufacturer,
  productionLine,
  onChange,
  inputClassName = DEFAULT_INPUT_CLASS,
  labelClassName = DEFAULT_LABEL_CLASS,
  layout = "stack",
}) {
  const options = useFixtureDescriptorOptions();

  return (
    <div className={layout === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "space-y-6"}>
      <div>
        <label className={labelClassName}>Manufacturer</label>
        <input
          type="text"
          list="fixture-manufacturer-options"
          value={manufacturer || ""}
          onChange={(e) => onChange("manufacturer", e.target.value)}
          placeholder="e.g. BOJAY ELECTRONICS CO"
          maxLength={100}
          className={inputClassName}
        />
        <datalist id="fixture-manufacturer-options">
          {options.manufacturers.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </div>
      <div>
        <label className={labelClassName}>Production Line</label>
        <input
          type="text"
          list="fixture-line-options"
          value={productionLine || ""}
          onChange={(e) => onChange("production_line", e.target.value)}
          placeholder="e.g. LINE 7"
          maxLength={50}
          className={inputClassName}
        />
        <datalist id="fixture-line-options">
          {options.production_lines.map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
