const HEX_REGEX = /^#?([0-9a-f]{6})$/i;

const DEFAULT_PRIMARY = "#007A6E";
const DEFAULT_SECONDARY = "#005247";
const DEFAULT_GLOW = "rgba(0, 122, 110, 0.35)";
const DEFAULT_HERO_TEXT = "#0F172A";

const normalizeHex = (value, fallback) => {
  if (!value || typeof value !== "string") {
    return fallback;
  }
  const match = HEX_REGEX.exec(value.trim());
  if (!match) {
    return fallback;
  }
  return `#${match[1].toUpperCase()}`;
};

export const withAlpha = (color, alpha = 1) => {
  const safeAlpha = Math.min(1, Math.max(0, alpha ?? 1));
  const normalized = normalizeHex(color, DEFAULT_PRIMARY).replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

export const getThemePalette = (theme) => {
  const primaryColor = normalizeHex(theme?.primaryColor, DEFAULT_PRIMARY);
  const secondaryColor = normalizeHex(theme?.secondaryColor, DEFAULT_SECONDARY);
  const heroTextColor = normalizeHex(theme?.heroTextColor, DEFAULT_HERO_TEXT);
  return {
    primaryColor,
    secondaryColor,
    glow: theme?.glow ?? DEFAULT_GLOW,
    gradient: theme?.gradient ?? `linear-gradient(120deg, ${primaryColor}, ${secondaryColor})`,
    heroTextColor,
  };
};

export const DEFAULT_THEME_COLORS = {
  primaryColor: DEFAULT_PRIMARY,
  secondaryColor: DEFAULT_SECONDARY,
  glow: DEFAULT_GLOW,
  gradient: `linear-gradient(120deg, ${DEFAULT_PRIMARY}, ${DEFAULT_SECONDARY})`,
  heroTextColor: DEFAULT_HERO_TEXT,
};
