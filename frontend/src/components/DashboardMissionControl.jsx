import { useEffect, useMemo, useState } from "react";

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

/** Count-up number with a soft odometer feel. */
export function AnimatedNumber({ value, duration = 900, className = "" }) {
  const [display, setDisplay] = useState(0);
  const target = Number(value) || 0;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(from + (target - from) * easeOutCubic(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

/** SVG ring gauge (0–100). Use tone="onDark" on the Floor ops hero. */
export function HealthRing({
  value,
  size = 112,
  stroke = 10,
  color = "#2563eb",
  track = "rgba(148,163,184,0.25)",
  label,
  sublabel,
  tone = "onDark",
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const onDark = tone === "onDark";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={onDark ? "rgba(255,255,255,0.18)" : track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="mmis-ring-draw"
          style={{ ["--ring-len"]: c, ["--ring-offset"]: offset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span
          className={`text-2xl font-black tabular-nums leading-none ${
            onDark ? "text-white drop-shadow" : "text-slate-800 dark:text-white"
          }`}
        >
          {Math.round(pct)}%
        </span>
        {label && (
          <span
            className={`mt-1 text-[10px] font-bold uppercase tracking-wide ${
              onDark ? "text-white/80" : "text-slate-500"
            }`}
          >
            {label}
          </span>
        )}
        {sublabel && (
          <span className={`text-[10px] font-medium ${onDark ? "text-cyan-100/80" : "text-slate-400"}`}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

/** Tiny 7-day activity bars from transaction timestamps. */
export function ActivitySpark({ transactions = [] }) {
  const bars = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return { key: d.getTime(), label: d.toLocaleDateString(undefined, { weekday: "narrow" }), count: 0 };
    });
    const start = days[0].key;
    (transactions || []).forEach((t) => {
      const ts = new Date(t.created_at);
      ts.setHours(0, 0, 0, 0);
      const key = ts.getTime();
      if (key < start) return;
      const row = days.find((d) => d.key === key);
      if (row) row.count += 1;
    });
    const max = Math.max(1, ...days.map((d) => d.count));
    return days.map((d) => ({ ...d, h: Math.max(8, Math.round((d.count / max) * 56)) }));
  }, [transactions]);

  return (
    <div className="flex h-16 items-end gap-1.5">
      {bars.map((d) => (
        <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-400 shadow-sm transition-all dark:from-blue-500 dark:to-cyan-300"
            style={{ height: d.h, animation: "mmis-bar-rise 700ms ease-out both" }}
            title={`${d.count} today`}
          />
          <span className="text-[9px] font-semibold uppercase text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Live Chicago clock + work week. */
export function LiveOpsClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // ISO week (approx for display) in America/Chicago local calendar date
  const chicagoParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(chicagoParts.find((p) => p.type === "year")?.value);
  const m = Number(chicagoParts.find((p) => p.type === "month")?.value);
  const day = Number(chicagoParts.find((p) => p.type === "day")?.value);
  const utc = new Date(Date.UTC(y, m - 1, day));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const ww = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="font-mono text-lg font-bold tracking-tight text-white tabular-nums sm:text-xl">{time}</span>
      </div>
      <span className="text-sm text-blue-100/80">{date} · CT</span>
      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur">
        WW{String(ww).padStart(2, "0")}
      </span>
    </div>
  );
}
