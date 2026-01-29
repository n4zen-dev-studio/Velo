import { View, ViewStyle } from "react-native"

import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { Priority } from "@/services/db/types"

interface PriorityDotProps {
  priority: Priority
}

export function PriorityDot({ priority }: PriorityDotProps) {
  const { themed } = useAppTheme()

  return <View style={themed($dot(priority))} />
}

const $dot = (priority: Priority): ThemedStyle<ViewStyle> => ({ colors }) => {
  const tint =
    priority === "low"
      ? colors.priorityLow
      : priority === "medium"
        ? colors.priorityMedium
        : colors.priorityHigh

  return {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tint,
  }
}
