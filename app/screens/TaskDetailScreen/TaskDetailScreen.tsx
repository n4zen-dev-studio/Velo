import { View, ViewStyle } from "react-native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { useTaskDetailViewModel } from "./useTaskDetailViewModel"

export function TaskDetailScreen() {
  const { themed } = useAppTheme()
  const { title, description, status, priority, assignee, comments, timeline, hasConflict } =
    useTaskDetailViewModel()

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text={title} />
        <Text preset="formHelper" text={`Status: ${status} · Priority: ${priority}`} />
        <Text preset="formHelper" text={`Assignee: ${assignee}`} />
      </View>

      {hasConflict ? (
        <GlassCard>
          <Text preset="subheading" text="Conflict detected" />
          <Text preset="formHelper" text="Resolve differences before editing." />
          <View style={themed($buttonRow)}>
            <Button text="Review conflict" preset="default" />
          </View>
        </GlassCard>
      ) : null}

      <GlassCard>
        <Text preset="subheading" text="Summary" />
        <Text preset="formHelper" text={description} />
      </GlassCard>

      <GlassCard>
        <Text preset="subheading" text="Comments" />
        <View style={themed($stack)}>
          {comments.map((comment) => (
            <View key={comment.id} style={themed($comment)}>
              <Text preset="formLabel" text={comment.author} />
              <Text preset="formHelper" text={comment.body} />
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <Text preset="subheading" text="Timeline" />
        <View style={themed($stack)}>
          {timeline.map((entry) => (
            <Text key={entry} preset="formHelper" text={entry} />
          ))}
        </View>
      </GlassCard>
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

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  gap: spacing.sm,
})

const $comment: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  padding: spacing.sm,
  borderRadius: 12,
  backgroundColor: colors.palette.neutral100,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  flexDirection: "row",
})
