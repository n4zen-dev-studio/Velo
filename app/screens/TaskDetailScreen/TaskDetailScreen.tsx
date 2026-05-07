import { View, ViewStyle, TextStyle, Pressable } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { useMemo } from "react"

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

  const statusLabel = useMemo(() => (task ? task.statusId : "—"), [task])
  const priorityLabel = useMemo(() => (task ? task.priority : "—"), [task])

  if (!task) {
    return (
      <Screen preset="fixed" contentContainerStyle={themed($screen)}>
        <Text preset="formHelper" text="Loading task..." />
      </Screen>
    )
  }

  return (
    <Screen preset="scroll" safeAreaEdges={["top", "bottom"]} contentContainerStyle={themed($screen)}>
      {/* Header */}
      <View style={themed($header)}>
        <Text preset="heading" text={task.title} />

        <View style={themed($metaRow)}>
          <View style={themed($metaPill)}>
            <Text preset="formHelper" text={`Status: ${statusLabel}`} style={themed($metaText)} />
          </View>
          <View style={themed($metaPill)}>
            <Text preset="formHelper" text={`Priority: ${priorityLabel}`} style={themed($metaText)} />
          </View>
          <View style={themed($metaPill)}>
            <Text
              preset="formHelper"
              text={`Assignee: ${task.assigneeUserId ?? "Unassigned"}`}
              style={themed($metaText)}
            />
          </View>
        </View>

        <View style={themed($buttonRow)}>
          <Button
            text="Edit"
            preset="glass"
            onPress={() => navigation.navigate("TaskEditor", { taskId: task.id })}
          />
          <Button
            text="Delete"
            preset="glass"
            onPress={async () => {
              await deleteTask()
              navigation.goBack()
            }}
          />
        </View>
      </View>

      {/* Summary */}
      <GlassCard>
        <View style={themed($sectionHeader)}>
          <Text preset="subheading" text="Summary" />
        </View>
        <Text
          preset="formHelper"
          text={task.description?.trim().length ? task.description : "No description yet."}
          style={themed($muted)}
        />
      </GlassCard>

      {/* Comments */}
      <GlassCard>
        <View style={themed($sectionHeaderBetween)}>
          <View>
            <Text preset="subheading" text="Comments" />
            <Text preset="formHelper" text={`${comments.length} total`} style={themed($muted)} />
          </View>

          {/* ✅ Add comment entry-point (no behavior change required if you already have a screen/route later) */}
          <Pressable
            style={themed($chipButton)}
            onPress={() => {
              // If you don’t have a comment composer screen yet, this keeps the app consistent:
              // You can route this to a modal/screen later without changing the UI again.
              console.warn("[TaskDetail] Add comment not implemented yet")
            }}
          >
            <Text preset="formHelper" text="Add" style={themed($chipText)} />
            <Text preset="formHelper" text="+" style={themed($chipText)} />
          </Pressable>
        </View>

        <View style={themed($stack)}>
          {comments.length === 0 ? (
            <Text preset="formHelper" text="No comments yet." style={themed($muted)} />
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={themed($commentCard)}>
                <View style={themed($commentHeader)}>
                  <Text preset="formLabel" text={comment.createdByUserId} />
                  {/* if you have createdAt, show it here later */}
                </View>
                <Text preset="formHelper" text={comment.body} style={themed($muted)} />
              </View>
            ))
          )}
        </View>
      </GlassCard>

      {/* Timeline */}
      <GlassCard>
        <View style={themed($sectionHeaderBetween)}>
          <View>
            <Text preset="subheading" text="Timeline" />
            <Text preset="formHelper" text={`${events.length} events`} style={themed($muted)} />
          </View>
        </View>

        <View style={themed($stack)}>
          {events.length === 0 ? (
            <Text preset="formHelper" text="No events yet." style={themed($muted)} />
          ) : (
            events.map((event) => (
              <View key={event.id} style={themed($eventRow)}>
                <Text preset="formLabel" text={event.type} />
                <Text preset="formHelper" text={event.payload} style={themed($muted)} />
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
  gap: spacing.sm,
})

const $metaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $metaPill: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.14)",
  backgroundColor: colors.card ?? "rgba(255,255,255,0.06)",
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
})

const $metaText: ThemedStyle<TextStyle> = () => ({
  opacity: 0.92,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
})

const $sectionHeaderBetween: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
  marginBottom: spacing.sm,
})

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $commentCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  padding: spacing.sm,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.14)",
  backgroundColor: colors.card ?? "rgba(255,255,255,0.06)",
})

const $commentHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: spacing.xs,
})

const $eventRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxs,
  paddingVertical: spacing.xs,
})

const $chipButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.14)",
  backgroundColor: colors.card ?? "rgba(255,255,255,0.06)",
})

const $chipText: ThemedStyle<TextStyle> = () => ({
  opacity: 0.92,
})

const $muted: ThemedStyle<TextStyle> = () => ({
  opacity: 0.85,
})
