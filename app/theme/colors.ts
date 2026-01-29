export const palette = {
  // Neutrals (light theme)
  neutral100: "#FFFFFF",
  neutral200: "#F6F5F8",
  neutral300: "#E6E3EA",
  neutral400: "#C9C3D1",
  neutral500: "#A69FB1",
  neutral600: "#5B5566",
  neutral700: "#3C3744",
  neutral800: "#221F27",
  neutral900: "#171418",

  // Primary (purple scale) — anchor: D5B3FF
  primary100: "#F4ECFF",
  primary200: "#E8D7FF",
  primary300: "#D5B3FF", // main
  primary400: "#B687FF",
  primary500: "#8F55FF",
  primary600: "#6B2FE6",

  // Secondary (cool slate / desaturated purple-gray)
  secondary100: "#EEF0F6",
  secondary200: "#D6DAE8",
  secondary300: "#B2B8D1",
  secondary400: "#7A839E",
  secondary500: "#4D556B",

  // Accent (soft light yellow)
  accent100: "#FFF9DB",
  accent200: "#FFF1AE",
  accent300: "#FFE57A",
  accent400: "#FFD84A",
  accent500: "#FFC61A",

  angry100: "#F2D6CD",
  angry500: "#C03403",

  // Overlays based on your dark anchor (171418)
  overlay20: "rgba(23, 20, 24, 0.2)",
  overlay50: "rgba(23, 20, 24, 0.5)",
} as const

export const colors = {
  /**
   * The palette is available to use, but prefer using the name.
   * This is only included for rare, one-off cases. Try to use
   * semantic names as much as possible.
   */
  palette,
  /**
   * A helper for making something see-thru.
   */
  transparent: "rgba(0, 0, 0, 0)",
  /**
   * The default text color in many components.
   */
  text: palette.neutral800,
  /**
   * Secondary text information.
   */
  textDim: palette.neutral600,
  /**
   * The default color of the screen background.
   */
  background: palette.neutral200,
  /**
   * The default border color.
   */
  border: palette.neutral400,
  /**
   * The main tinting color.
   */
  tint: palette.primary500,
  /**
   * The inactive tinting color.
   */
  tintInactive: palette.neutral300,
  /**
   * A subtle color used for lines.
   */
  separator: palette.neutral300,
  /**
   * Error messages.
   */
  error: palette.angry500,
  /**
   * Error Background.
   */
  errorBackground: palette.angry100,
} as const
