import { Platform } from "react-native"
import {
  SpaceGrotesk_300Light as spaceGroteskLight,
  SpaceGrotesk_400Regular as spaceGroteskRegular,
  SpaceGrotesk_500Medium as spaceGroteskMedium,
  SpaceGrotesk_600SemiBold as spaceGroteskSemiBold,
  SpaceGrotesk_700Bold as spaceGroteskBold,
} from "@expo-google-fonts/space-grotesk"

export const customFontsToLoad = {
  spaceGroteskLight,
  spaceGroteskRegular,
  spaceGroteskMedium,
  spaceGroteskSemiBold,
  spaceGroteskBold,
  "GeneralSans-Light": require("@assets/fonts/GeneralSans-Light.otf"),
  "GeneralSans-LightItalic": require("@assets/fonts/GeneralSans-LightItalic.otf"),
  "GeneralSans-Regular": require("@assets/fonts/GeneralSans-Regular.otf"),
  "GeneralSans-Italic": require("@assets/fonts/GeneralSans-Italic.otf"),
  "GeneralSans-Medium": require("@assets/fonts/GeneralSans-Medium.otf"),
  "GeneralSans-MediumItalic": require("@assets/fonts/GeneralSans-MediumItalic.otf"),
  "GeneralSans-Semibold": require("@assets/fonts/GeneralSans-Semibold.otf"),
  "GeneralSans-SemiboldItalic": require("@assets/fonts/GeneralSans-SemiboldItalic.otf"),
  "GeneralSans-Bold": require("@assets/fonts/GeneralSans-Bold.otf"),
  "GeneralSans-BoldItalic": require("@assets/fonts/GeneralSans-BoldItalic.otf"),
  "GeneralSans-Extralight": require("@assets/fonts/GeneralSans-Extralight.otf"),
  "GeneralSans-ExtralightItalic": require("@assets/fonts/GeneralSans-ExtralightItalic.otf"),
}

const fonts = {
  generalSans: {
    extraLight: "GeneralSans-Extralight",
    extraLightItalic: "GeneralSans-ExtralightItalic",

    light: "GeneralSans-Light",
    lightItalic: "GeneralSans-LightItalic",

    normal: "GeneralSans-Regular",
    italic: "GeneralSans-Italic",

    medium: "GeneralSans-Medium",
    mediumItalic: "GeneralSans-MediumItalic",

    semiBold: "GeneralSans-Semibold",
    semiBoldItalic: "GeneralSans-SemiboldItalic",

    bold: "GeneralSans-Bold",
    boldItalic: "GeneralSans-BoldItalic",
  },
  spaceGrotesk: {
    light: "spaceGroteskLight",
    normal: "spaceGroteskRegular",
    medium: "spaceGroteskMedium",
    semiBold: "spaceGroteskSemiBold",
    bold: "spaceGroteskBold",
  },
  helveticaNeue: {
    thin: "HelveticaNeue-Thin",
    light: "HelveticaNeue-Light",
    normal: "Helvetica Neue",
    medium: "HelveticaNeue-Medium",
  },
  courier: {
    normal: "Courier",
  },
  sansSerif: {
    thin: "sans-serif-thin",
    light: "sans-serif-light",
    normal: "sans-serif",
    medium: "sans-serif-medium",
  },
  monospace: {
    normal: "monospace",
  },
}

const role = (fontFamily: string, fontSize: number, lineHeight: number, letterSpacing = 0) => ({
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing,
})

export const typography = {
  fonts,
  primary: fonts.generalSans,
  secondary: Platform.select({ ios: fonts.helveticaNeue, android: fonts.generalSans.medium }),
  code: Platform.select({ ios: fonts.courier, android: fonts.monospace }),
  roles: {
    display: role(fonts.generalSans.semiBold, 40, 44, -1.1),
    title1: role(fonts.generalSans.semiBold, 30, 36, -0.8),
    title2: role(fonts.generalSans.semiBold, 24, 30, -0.5),
    title3: role(fonts.generalSans.semiBold, 18, 26, -0.25),
    sectionTitle: role(fonts.generalSans.semiBold, 17, 22, -0.1),
    body: role(fonts.generalSans.normal, 15, 22, 0.05),
    bodySmall: role(fonts.generalSans.normal, 13, 19, 0.08),
    label: role(fonts.generalSans.medium, 13, 18, 0.15),
    caption: role(fonts.generalSans.normal, 12, 16, 0.2),
    overline: role(fonts.generalSans.medium, 11, 14, 0.7),
    button: role(fonts.generalSans.semiBold, 15, 18, 0.1),
  },
}
