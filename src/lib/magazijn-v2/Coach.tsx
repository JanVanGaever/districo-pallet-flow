import { useEffect, useState } from "react";

type Spot = {
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
  soft: boolean;
  safeTop: number;
  bubble: "auto" | "above" | "below";
};

function isVisible(el: HTMLElement) {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return false;
  return true;
}

/**
 * Demo-/leermodus: zoekt het element met [data-coach] (de voorgestelde volgende actie)
 * en toont een bewegend handje met een tekstballon.
 */
export function Coach({ enabled }: { enabled: boolean }) {
  const [spot, setSpot] = useState<Spot | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSpot(null);
      return;
    }
    let raf = 0;
    const update = () => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>("[data-coach]"),
      ).filter(isVisible);
      candidates.sort(
        (a, b) =>
          Number(a.dataset["coachOrder"] ?? 0) - Number(b.dataset["coachOrder"] ?? 0),
      );
      const el = candidates[0];
      if (!el) {
        setSpot(null);
      } else {
        const r = el.getBoundingClientRect();
        const label = el.dataset["coach"] || "Tik hier";
        const soft = el.dataset["coachSoft"] === "true";
        const requestedBubble = el.dataset["coachBubble"];
        const bubble: Spot["bubble"] = requestedBubble === "below" || requestedBubble === "above"
          ? requestedBubble
          : "auto";
        const header = document.querySelector("header");
        const safeTop = header ? header.getBoundingClientRect().bottom + 8 : 0;
        setSpot((prev) =>
          prev &&
          prev.label === label &&
          prev.soft === soft &&
          prev.bubble === bubble &&
          prev.safeTop === safeTop &&
          Math.abs(prev.top - r.top) < 1 &&
          Math.abs(prev.left - r.left) < 1 &&
          Math.abs(prev.width - r.width) < 1
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height, label, soft, safeTop, bubble },
        );
      }
      raf = window.setTimeout(update, 250);
    };
    update();
    return () => window.clearTimeout(raf);
  }, [enabled]);

  if (!enabled || !spot) return null;

  const centerX = spot.left + spot.width / 2;
  const rawTop = spot.top - 6;
  const rawBottom = spot.top + spot.height + 6;
  const ringTop = Math.max(rawTop, spot.safeTop);
  const ringHeight = rawBottom - ringTop;
  // element grotendeels verborgen onder de bovenbalk: niets tekenen
  if (ringHeight < 32) return null;

  const bubbleTop =
    spot.bubble === "below"
      ? ringTop + ringHeight + 12
      : spot.bubble === "above"
        ? Math.max(ringTop - 66, spot.safeTop)
        : ringTop - 66 >= spot.safeTop
          ? ringTop - 66
          : ringTop + ringHeight + 12;
  const handTop = Math.max(ringTop + ringHeight / 2 - 8, spot.safeTop);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* highlight ring */}
      <div
        className={`absolute rounded-2xl ${
          spot.soft
            ? "ring-2 ring-neutral-400/60"
            : "ring-4 ring-red-500/70 [animation:coach-pulse_1.6s_ease-in-out_infinite]"
        }`}
        style={{ top: ringTop, left: spot.left - 6, width: spot.width + 12, height: ringHeight }}
      />
      {/* tekstballon */}
      <div
        className="absolute -translate-x-1/2 rounded-xl bg-neutral-800 px-4 py-2 text-base font-semibold text-white shadow-lg"
        style={{ top: bubbleTop, left: Math.min(Math.max(centerX, 90), window.innerWidth - 90) }}
      >
        {spot.label}
      </div>
      {/* bewegend handje — niet bij een vrije keuze */}
      {!spot.soft && (
      <div
        className="absolute -translate-x-1/2 text-4xl drop-shadow-md [animation:coach-tap_1.2s_ease-in-out_infinite]"
        style={{ top: handTop, left: centerX + 24 }}
      >
        👆
      </div>
      )}
    </div>
  );
}
