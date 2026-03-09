const palette = {
  // Neutrals (dark theme) — anchor: 171418
  neutral900: "#FFFFFF",
  neutral800: "#F1F0F3",
  neutral700: "#D6D3DB",
  neutral600: "#A8A3B0",
  neutral500: "#80798F",
  neutral400: "#4B4656",
  neutral300: "#2C2734",
  neutral200: "#1E1A24",
  neutral100: "#171418",

  // Primary reversed for dark tokens usage (keeps Ignite’s convention)
  primary600: "#F4ECFF",
  primary500: "#E8D7FF",
  primary400: "#D5B3FF", // main
  primary300: "#B687FF",
  primary200: "#8F55FF",
  primary100: "#6B2FE6",
  primary: "#7f4efc",

  // Secondary reversed
  secondary500: "#EEF0F6",
  secondary400: "#D6DAE8",
  secondary300: "#B2B8D1",
  secondary200: "#7A839E",
  secondary100: "#4D556B",

  // Accent reversed (yellow pops nicely on dark)
  accent500: "#FFF9DB",
  accent400: "#FFF1AE",
  accent300: "#FFE57A",
  accent200: "#FFD84A",
  accent100: "#FFC61A",

  // Priority tokens
  priorityLow: "#4CD28A",
  priorityMedium: "#F5D057",
  priorityHigh: "#FF6B6B",

  angry100: "#F2D6CD",
  angry500: "#C03403",

  overlay20: "rgba(23, 20, 24, 0.2)",
  overlay50: "rgba(23, 20, 24, 0.5)",
} as const

export const colors = {
  palette,
  transparent: "rgba(0, 0, 0, 0)",
  text: palette.neutral800,
  textDim: palette.neutral600,
  background: palette.neutral200,
  border: palette.neutral400,
  tint: palette.primary500,
  tintInactive: palette.neutral300,
  separator: palette.neutral300,
  error: palette.angry500,
  errorBackground: palette.angry100,
  priorityLow: palette.priorityLow,
  priorityMedium: palette.priorityMedium,
  priorityHigh: palette.priorityHigh,
} as const
