import { View, ViewStyle } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"

import { useTaskDetailViewModel } from "./useTaskDetailViewModel"

export function TaskDetailScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<HomeStackScreenProps<"TaskDetail">["navigation"]>()
  const route = useRoute<HomeStackScreenProps<"TaskDetail">["route"]>()
  const { taskId } = route.params
  const { task, comments, events, deleteTask } = useTaskDetailViewModel(taskId)

  if (!task) {
    return (
      <Screen preset="fixed" contentContainerStyle={themed($screen)}>
        <Text preset="formHelper" text="Loading task..." />
      </Screen>
    )
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text={task.title} />
        <Text preset="formHelper" text={`Status: ${task.statusId} · Priority: ${task.priority}`} />
        <Text preset="formHelper" text={`Assignee: ${task.assigneeUserId ?? "Unassigned"}`} />
        <View style={themed($buttonRow)}>
          <Button
            text="Edit"
            preset="default"
            onPress={() => navigation.navigate("TaskEditor", { taskId: task.id })}
          />
          <Button
            text="Delete"
            preset="reversed"
            onPress={async () => {
              await deleteTask()
              navigation.goBack()
            }}
          />
        </View>
      </View>

      <GlassCard>
        <Text preset="subheading" text="Summary" />
        <Text preset="formHelper" text={task.description} />
      </GlassCard>

      <GlassCard>
        <Text preset="subheading" text="Comments" />
        <View style={themed($stack)}>
          {comments.length === 0 ? (
            <Text preset="formHelper" text="No comments yet." />
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={themed($comment)}>
                <Text preset="formLabel" text={comment.createdByUserId} />
                <Text preset="formHelper" text={comment.body} />
              </View>
            ))
          )}
        </View>
      </GlassCard>

      <GlassCard>
        <Text preset="subheading" text="Timeline" />
        <View style={themed($stack)}>
          {events.length === 0 ? (
            <Text preset="formHelper" text="No events yet." />
          ) : (
            events.map((event) => (
              <View key={event.id}>
                <Text preset="formLabel" text={event.type} />
                <Text preset="formHelper" text={event.payload} />
              </View>
            ))
          )}
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
