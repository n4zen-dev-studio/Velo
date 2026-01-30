import { useEffect, useState } from "react"
import { Pressable, View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"

import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { listOpenConflicts } from "@/services/db/repositories/conflictsRepository"
import type { ConflictRecord } from "@/services/db/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function ConflictListScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<AppStackScreenProps<"ConflictList">["navigation"]>()
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([])

  useEffect(() => {
    listOpenConflicts().then(setConflicts)
  }, [])

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Conflicts" />
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
                entityType: conflict.entityType as "task" | "comment",
                entityId: conflict.entityId,
              })
            }
          >
            <GlassCard>
              <Text preset="subheading" text={`${conflict.entityType} conflict`} />
              <Text preset="formHelper" text={`ID: ${conflict.entityId}`} />
              <Text preset="formHelper" text={`Updated: ${conflict.createdAt}`} />
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
