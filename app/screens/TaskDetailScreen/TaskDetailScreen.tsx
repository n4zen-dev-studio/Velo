import { View, ViewStyle, TextStyle } from "react-native"
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { formatDateTime } from "@/utils/dateFormat"
import { resolveUserLabel } from "@/utils/userLabel"

import { useTaskDetailViewModel } from "./useTaskDetailViewModel"

export function TaskDetailScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<HomeStackScreenProps<"TaskDetail">["navigation"]>()
  const route = useRoute<HomeStackScreenProps<"TaskDetail">["route"]>()
  const { taskId } = route.params
  const { task, comments, events, statusMap, deleteTask, addComment, isSavingComment, commentError, refresh } =
    useTaskDetailViewModel(taskId)
  const [commentDraft, setCommentDraft] = useState("")
  const [assigneeLabel, setAssigneeLabel] = useState<string>("Unassigned")

  const statusLabel = useMemo(() => {
    if (!task) return "—"
    return statusMap[task.statusId] ?? task.statusId
  }, [statusMap, task])
  const priorityLabel = useMemo(() => (task ? task.priority : "—"), [task])
  const canSend = commentDraft.trim().length > 0 && !isSavingComment

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh]),
  )

  useEffect(() => {
    void (async () => {
      if (!task?.assigneeUserId) {
        setAssigneeLabel("Unassigned")
        return
      }
      const label = await resolveUserLabel(task.assigneeUserId)
      setAssigneeLabel(label)
    })()
  }, [task?.assigneeUserId])

  const timelineItems = useMemo(() => {
    return events.map((event) => {
      let title = event.type || "Activity"
      let detail = ""
      try {
        const payload = event.payload ? JSON.parse(event.payload) : null
        const fromStatusId = payload?.fromStatusId ?? payload?.fromStatus ?? payload?.from
        const toStatusId = payload?.toStatusId ?? payload?.toStatus ?? payload?.to
        if (event.type === "STATUS_CHANGED" || (fromStatusId && toStatusId)) {
          title = "Status changed"
          const fromLabel = statusMap[fromStatusId] ?? String(fromStatusId ?? "—")
          const toLabel = statusMap[toStatusId] ?? String(toStatusId ?? "—")
          detail = `From ${fromLabel} → To ${toLabel}`
        } else if (payload?.message) {
          detail = String(payload.message)
        }
      } catch {
        // ignore malformed payloads
      }

      return {
        id: event.id,
        title,
        detail,
        authorLabel: event.authorLabel,
        createdAt: event.createdAt,
      }
    })
  }, [events, statusMap])

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
              text={`Assignee: ${assigneeLabel}`}
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
        </View>

        <View style={themed($composer)}>
          <TextField
            value={commentDraft}
            onChangeText={setCommentDraft}
            placeholder="Write a comment..."
            multiline
            numberOfLines={3}
            editable={!isSavingComment}
          />
          {commentError ? (
            <Text preset="formHelper" text={commentError} style={themed($errorText)} />
          ) : null}
          <View style={themed($composerActions)}>
            <Button
              text={isSavingComment ? "Sending..." : "Send"}
              preset="glass"
              onPress={async () => {
                const created = await addComment(commentDraft)
                if (created) {
                  setCommentDraft("")
                }
              }}
              disabled={!canSend}
            />
          </View>
        </View>

        <View style={themed($stack)}>
          {comments.length === 0 ? (
            <Text preset="formHelper" text="No comments yet." style={themed($muted)} />
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={themed($commentCard)}>
                <View style={themed($commentHeader)}>
                  <Text preset="formLabel" text={comment.authorLabel} />
                  <Text
                    preset="formHelper"
                    text={formatDateTime(comment.createdAt)}
                    style={themed($muted)}
                  />
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
            timelineItems.map((item) => (
              <View key={item.id} style={themed($eventCard)}>
                <Text preset="formLabel" text={item.title} />
                {item.detail ? <Text preset="formHelper" text={item.detail} style={themed($muted)} /> : null}
                <Text
                  preset="formHelper"
                  text={`by ${item.authorLabel} · ${formatDateTime(item.createdAt)}`}
                  style={themed($muted)}
                />
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
  paddingBottom: spacing.xxl,
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

const $composer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  marginBottom: spacing.md,
})

const $composerActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: spacing.sm,
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
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: spacing.xs,
})

const $eventCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  gap: spacing.xxs,
  padding: spacing.sm,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.14)",
  backgroundColor: colors.card ?? "rgba(255,255,255,0.06)",
})

const $muted: ThemedStyle<TextStyle> = () => ({
  opacity: 0.85,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})
