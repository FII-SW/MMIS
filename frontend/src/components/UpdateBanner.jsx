import { useEffect, useState } from "react";

/** Prompt reload when nginx still has a newer index.html than the JS this tab loaded. */
export default function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/?_=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const html = await res.text();
        const match = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
        if (!match) return;
        const current = [...document.scripts]
          .map((s) => s.getAttribute("src") || "")
          .find((src) => /\/assets\/index-/.test(src));
        if (current && !current.includes(match[1]) && !cancelled) setShow(true);
      } catch {
        /* offline / blocked */
      }
    };

    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[60] flex max-w-lg -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <span>MMIS was updated. Reload to see the latest forms (including Board validation).</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
      >
        Reload now
      </button>
    </div>
  );
}
