import { useState } from "react"
import { View, ViewStyle } from "react-native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { useTaskEditorViewModel } from "./useTaskEditorViewModel"

export function TaskEditorScreen() {
  const { themed } = useAppTheme()
  const { title, description, priorities, statuses } = useTaskEditorViewModel()
  const [currentTitle, setCurrentTitle] = useState(title)
  const [currentDescription, setCurrentDescription] = useState(description)

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Create task" />
        <Text preset="formHelper" text="Personal workspace" />
      </View>

      <GlassCard>
        <Text preset="formLabel" text="Title" />
        <TextField value={currentTitle} onChangeText={setCurrentTitle} placeholder="Task title" />
        <View style={themed($spacer)} />
        <Text preset="formLabel" text="Description" />
        <TextField
          value={currentDescription}
          onChangeText={setCurrentDescription}
          placeholder="Add a short summary"
          multiline
          numberOfLines={4}
        />
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Priority" />
        <View style={themed($pillRow)}>
          {priorities.map((priority) => (
            <View key={priority} style={themed($pill)}>
              <Text text={priority} />
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Status" />
        <View style={themed($pillRow)}>
          {statuses.map((status) => (
            <View key={status} style={themed($pill)}>
              <Text text={status} />
            </View>
          ))}
        </View>
      </GlassCard>

      <View style={themed($buttonRow)}>
        <Button text="Save task" preset="default" />
        <Button text="Discard" preset="reversed" />
      </View>
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

const $spacer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  height: spacing.sm,
})

const $pillRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
  marginTop: spacing.sm,
})

const $pill: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: 12,
  backgroundColor: colors.palette.neutral100,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})
