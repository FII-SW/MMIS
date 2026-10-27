/**
 * Blue page title bar with a always-visible Back control (top-left).
 * Use on project/test-area pickers where a bottom "Back" was easy to miss on short screens.
 */
export default function PageHeaderWithBack({ title, onBack }) {
  return (
    <div className="relative mb-3 w-full overflow-visible bg-blue-600 shadow-md transition-colors dark:bg-blue-800 2xl:mb-5 short:mb-2">
      <div className="relative flex min-h-[42px] items-center justify-center overflow-visible px-2 py-2 sm:px-4 2xl:min-h-[48px] 2xl:py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="absolute left-2 top-1/2 z-20 inline-flex -translate-y-1/2 items-center gap-1 rounded-lg border border-white/20 bg-white/15 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/25 sm:left-4 sm:px-2.5 sm:text-sm"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="w-full px-14 text-center text-lg font-bold leading-tight text-white sm:px-20 sm:text-xl md:px-24 2xl:text-2xl">
          {title}
        </h1>
      </div>
    </div>
  );
}
