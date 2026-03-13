import { useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateTime } from "@/utils/dateFormat"
import { resolveUserLabel } from "@/utils/userLabel"

import { useTaskDetailViewModel } from "./useTaskDetailViewModel"

export function TaskDetailScreen() {
  const { themed, theme } = useAppTheme()
  const navigation = useNavigation<HomeStackScreenProps<"TaskDetail">["navigation"]>()
  const route = useRoute<HomeStackScreenProps<"TaskDetail">["route"]>()
  const { taskId } = route.params
  const {
    task,
    comments,
    events,
    statusMap,
    deleteTask,
    addComment,
    isSavingComment,
    commentError,
    refresh,
  } = useTaskDetailViewModel(taskId)
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
          detail = `${fromLabel} -> ${toLabel}`
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
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <View style={themed($headerTop)}>
          <Pressable onPress={() => navigation.goBack()} style={themed($backButton)}>
            <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
          </Pressable>
          <View style={themed($headerCopy)}>
            <Text preset="overline" text="Task" />
            <Text preset="subheading" text={task.title} style={themed($title)} />
            <Text
              preset="caption"
              text="Task summary, discussion, and execution history."
              style={themed($subtitle)}
            />
          </View>
        </View>

        <View style={themed($metaRow)}>
          <TaskMetaChip label="Status" value={statusLabel} />
          <TaskMetaChip label="Priority" value={priorityLabel} />
          <TaskMetaChip label="Assignee" value={assigneeLabel} />
        </View>

        <View style={themed($actionRow)}>
          <Button
            text="Edit"
            preset="glass"
            onPress={() => navigation.navigate("TaskEditor", { taskId: task.id })}
            style={themed($inlineAction)}
          />
          <Button
            text="Delete"
            preset="reversed"
            onPress={async () => {
              await deleteTask()
              navigation.goBack()
            }}
            style={themed($inlineAction)}
          />
        </View>
      </View>

      <GlassCard>
        <SectionHeader title="Summary" subtitle="Task brief" />
        <Text
          preset="caption"
          text={task.description?.trim().length ? task.description : "No description yet."}
          style={themed($bodyText)}
        />
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Comments" subtitle={`${comments.length} total`} />

        <View style={themed($composer)}>
          <TextField
            value={commentDraft}
            onChangeText={setCommentDraft}
            placeholder="Add a comment..."
            multiline
            numberOfLines={2}
            editable={!isSavingComment}
          />
          <View style={themed($composerFooter)}>
            <Text
              preset="caption"
              text={commentError ?? "Keep updates short and actionable."}
              style={themed(commentError ? $errorText : $subtitle)}
            />
            <Button
              text={isSavingComment ? "Sending..." : "Send"}
              preset="glass"
              onPress={async () => {
                const created = await addComment(commentDraft)
                if (created) setCommentDraft("")
              }}
              disabled={!canSend}
            />
          </View>
        </View>

        <View style={themed($stack)}>
          {comments.length === 0 ? (
            <Text preset="caption" text="No comments yet." style={themed($subtitle)} />
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={themed($commentRow)}>
                <View style={themed($commentHeader)}>
                  <Text preset="caption" text={comment.authorLabel} style={themed($strongText)} />
                  <Text
                    preset="caption"
                    text={formatDateTime(comment.createdAt)}
                    style={themed($subtitle)}
                  />
                </View>
                <Text preset="caption" text={comment.body} style={themed($bodyText)} />
              </View>
            ))
          )}
        </View>
      </GlassCard>

      <GlassCard>
        <SectionHeader title="Activity" subtitle={`${events.length} events`} />

        <View style={themed($stack)}>
          {events.length === 0 ? (
            <Text preset="caption" text="No events yet." style={themed($subtitle)} />
          ) : (
            timelineItems.map((item) => (
              <TaskActivityRow
                key={item.id}
                title={item.title}
                detail={item.detail}
                meta={`by ${item.authorLabel} · ${formatDateTime(item.createdAt)}`}
              />
            ))
          )}
        </View>
      </GlassCard>
    </Screen>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($sectionHeader)}>
      <Text preset="formLabel" text={title} />
      <Text preset="caption" text={subtitle} style={themed($subtitle)} />
    </View>
  )
}

function TaskMetaChip({ label, value }: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($metaChip)}>
      <Text preset="caption" text={label} style={themed($subtitle)} />
      <Text preset="caption" text={value} style={themed($strongText)} numberOfLines={1} />
    </View>
  )
}

function TaskActivityRow({ title, detail, meta }: { title: string; detail: string; meta: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($activityRow)}>
      <View style={themed($activityDot)} />
      <View style={themed($activityCopy)}>
        <Text preset="caption" text={title} style={themed($strongText)} />
        {detail ? <Text preset="caption" text={detail} style={themed($bodyText)} /> : null}
        <Text preset="caption" text={meta} style={themed($subtitle)} />
      </View>
    </View>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.md,
  gap: spacing.md,
  paddingBottom: spacing.xxxl,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $headerTop: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.sm,
})

const $backButton: ThemedStyle<ViewStyle> = ({ colors, radius, spacing }) => ({
  width: 36,
  height: 36,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  alignItems: "center",
  justifyContent: "center",
  marginTop: spacing.xxxs,
})

const $headerCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $title: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $metaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $metaChip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $actionRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $inlineAction: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxxs,
  marginBottom: spacing.sm,
})

const $bodyText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
  lineHeight: 20,
})

const $composer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  marginBottom: spacing.sm,
})

const $composerFooter: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $commentRow: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.xs,
})

const $commentHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $activityRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.sm,
})

const $activityDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: colors.primary,
  marginTop: 5,
})

const $activityCopy: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  gap: spacing.xxxs,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
})

const $strongText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})
