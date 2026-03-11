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
}

const fonts = {
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
  primary: fonts.spaceGrotesk,
  secondary: Platform.select({ ios: fonts.helveticaNeue, android: fonts.sansSerif }),
  code: Platform.select({ ios: fonts.courier, android: fonts.monospace }),
  roles: {
    display: role(fonts.spaceGrotesk.bold, 40, 44, -1.1),
    title1: role(fonts.spaceGrotesk.bold, 30, 36, -0.8),
    title2: role(fonts.spaceGrotesk.semiBold, 24, 30, -0.5),
    title3: role(fonts.spaceGrotesk.semiBold, 20, 26, -0.25),
    sectionTitle: role(fonts.spaceGrotesk.semiBold, 17, 22, -0.1),
    body: role(fonts.spaceGrotesk.normal, 15, 22, 0.05),
    bodySmall: role(fonts.spaceGrotesk.normal, 13, 19, 0.08),
    label: role(fonts.spaceGrotesk.medium, 13, 18, 0.15),
    caption: role(fonts.spaceGrotesk.normal, 12, 16, 0.2),
    overline: role(fonts.spaceGrotesk.medium, 11, 14, 0.7),
    button: role(fonts.spaceGrotesk.semiBold, 15, 18, 0.1),
  },
}
