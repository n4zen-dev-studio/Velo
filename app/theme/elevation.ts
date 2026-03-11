import type { ViewStyle } from "react-native"

type ElevationSet = {
  card: ViewStyle
  floating: ViewStyle
  glow: ViewStyle
}

export const lightElevation: ElevationSet = {
  card: {
    shadowColor: "#6A75A8",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  floating: {
    shadowColor: "#5561A0",
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  glow: {
    shadowColor: "#A56FFF",
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
}

export const darkElevation: ElevationSet = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.38,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  floating: {
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 18,
  },
  glow: {
    shadowColor: "#7BC9FF",
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
}
