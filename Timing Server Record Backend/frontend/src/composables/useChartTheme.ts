import { ref, computed } from "vue";

// ═══════════════════════════════════════════
// Theme Tracker — singleton observer
// ═══════════════════════════════════════════

const isDark = ref(true);
let initialized = false;

function ensureThemeObserver() {
  if (initialized) return;
  initialized = true;
  const html = document.documentElement;
  isDark.value = html.getAttribute("data-theme") !== "light";
  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.getAttribute("data-theme") !== "light";
  });
  observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
}

export function useTheme() {
  ensureThemeObserver();
  return isDark;
}

// ═══════════════════════════════════════════
// Chart Color Palette  (8-color sequence)
// ═══════════════════════════════════════════
export const CHART_COLORS = [
  "#34d399", "#fbbf24", "#818cf8", "#f472b6",
  "#fb923c", "#a78bfa", "#2dd4bf", "#f87171",
] as const;

// ═══════════════════════════════════════════
// Theme-aware Tooltip Style (reactive)
// ═══════════════════════════════════════════
export function useTooltipStyle() {
  const dark = useTheme();
  return computed(() => ({
    backgroundColor: dark.value ? "rgba(17,24,39,0.95)" : "rgba(255,255,255,0.95)",
    borderColor: "rgba(139,92,246,0.25)",
    borderRadius: 8,
    boxShadow: dark.value
      ? "0 8px 24px rgba(0,0,0,0.5)"
      : "0 8px 24px rgba(0,0,0,0.08)",
    textStyle: { color: dark.value ? "#e5e7eb" : "#374151", fontSize: 12 },
  }));
}

// ═══════════════════════════════════════════
// Axis Theme Helpers (call inside computed)
// ═══════════════════════════════════════════
export const axisLabelStyle = (dark: boolean) => ({
  color: dark ? "#9ca3af" : "#6b7280",
  fontSize: 11,
});

export const axisYStyle = (dark: boolean) => ({
  nameTextStyle: { color: dark ? "#9ca3af" : "#6b7280", fontSize: 11 },
  axisLabel: { color: dark ? "#9ca3af" : "#6b7280", fontSize: 11 },
  splitLine: {
    lineStyle: { color: dark ? "#374151" : "#e5e7eb", opacity: 0.5 },
  },
});

export const pieLabelStyle = (dark: boolean) => ({
  color: dark ? "#9ca3af" : "#6b7280",
  fontSize: 11,
});

export const pieLabelLineStyle = (dark: boolean) => ({
  lineStyle: { color: dark ? "#4b5563" : "#d1d5db" },
});
