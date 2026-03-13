import { useEffect, useState } from "react"
import { Pressable, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"

import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { SyncStackScreenProps } from "@/navigators/navigationTypes"
import { listOpenConflicts } from "@/services/db/repositories/conflictsRepository"
import type { ConflictRecord } from "@/services/db/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateTime } from "@/utils/dateFormat"

export function ConflictListScreen() {
  const { themed, theme } = useAppTheme()
  const navigation = useNavigation<SyncStackScreenProps<"ConflictList">["navigation"]>()
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([])

  useEffect(() => {
    listOpenConflicts().then(setConflicts)
  }, [])

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <View style={themed($headerTopRow)}>
          <Pressable onPress={() => navigation.goBack()} style={themed($backButton)}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Text preset="heading" text="Conflicts" />
        </View>
        <Text preset="formHelper" text="Resolve before editing" />
      </View>

      {conflicts.length === 0 ? (
        <GlassCard>
          <Text preset="formHelper" text="No open conflicts." />
        </GlassCard>
      ) : (
        conflicts.map((conflict) => (
          <Pressable
            key={conflict.id}
            onPress={() =>
              navigation.navigate("ConflictResolution", {
                conflictId: conflict.id,
              })
            }
          >
            <GlassCard>
              <Text preset="subheading" text={`${conflict.entityType} conflict`} />
              <Text preset="formHelper" text={`Updated: ${formatDateTime(conflict.createdAt)}`} />
            </GlassCard>
          </Pressable>
        ))
      )}
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.lg,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $headerTopRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $backButton: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: 36,
  height: 36,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  alignItems: "center",
  justifyContent: "center",
})
