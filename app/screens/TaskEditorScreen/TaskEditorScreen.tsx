import { useEffect, useMemo, useState } from "react"
import { Pressable, View, ViewStyle, TextStyle } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { useSyncStatus } from "@/services/sync/syncStore"
import { hasOpenConflict } from "@/services/db/repositories/conflictsRepository"
import { useWorkspaceStore } from "@/stores/workspaceStore"

import { useTaskEditorViewModel } from "./useTaskEditorViewModel"

export function TaskEditorScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<HomeStackScreenProps<"TaskEditor">["navigation"]>()
  const route = useRoute<HomeStackScreenProps<"TaskEditor">["route"]>()
  const { taskId, projectId } = route.params ?? {}
  const {
    task,
    statuses,
    priorityOptions,
    defaultValues,
    saveTask,
    isSaving,
    assigneeOptions,
    assigneeUserId,
    setAssigneeUserId,
  } = useTaskEditorViewModel(taskId, projectId)
  const syncState = useSyncStatus()
  const [hasConflict, setHasConflict] = useState(false)
  const { workspaces, activeWorkspaceId } = useWorkspaceStore()

  const workspaceLabel = useMemo(() => {
    const targetId = task?.workspaceId ?? activeWorkspaceId
    return workspaces.find((w) => w.id === targetId)?.label ?? "Personal"
  }, [task?.workspaceId, activeWorkspaceId, workspaces])

  useEffect(() => {
    if (!taskId) return
    hasOpenConflict("task", taskId).then(setHasConflict)
  }, [taskId])

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().optional().default(""),
        statusId: z.string().min(1, "Status is required"),
        priority: z.enum(["low", "medium", "high"]),
      }),
    [],
  )

  const resolver = async (values: unknown) => {
    const result = schema.safeParse(values)
    if (result.success) {
      return { values: result.data, errors: {} }
    }
    const errors = result.error.flatten().fieldErrors
    return {
      values: {},
      errors: Object.fromEntries(
        Object.entries(errors).map(([key, message]) => [
          key,
          { type: "validation", message: message?.[0] },
        ]),
      ),
    }
  }

  const { control, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues,
    resolver,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const priorityValue = watch("priority")
  const statusValue = watch("statusId")

  const onSubmit = handleSubmit(async (values) => {
    const saved = await saveTask(values)
    task ? navigation.replace("TaskDetail", { taskId: saved.id }) : navigation.goBack()
  })

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <Text preset="display" text={task ? "Edit task" : "Create task"} />
        <Text preset="formHelper" text={`Workspace: ${workspaceLabel}`} style={themed($subtitle)} />
      </View>

      {hasConflict ? (
        <GlassCard>
          <Text preset="subheading" text="Editing locked" />
          <Text
            preset="formHelper"
            text="This item has a sync conflict and must be resolved before editing."
          />
          <View style={themed($buttonRow)}>
            <Button
              text="Resolve Conflict"
              preset="reversed"
              onPress={() =>
                navigation.navigate("ConflictResolution", { conflictId: `task:${taskId ?? ""}` })
              }
            />
          </View>
        </GlassCard>
      ) : null}

      <GlassCard>
        <Text preset="formLabel" text="Title" />
        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange } }) => (
            <TextField
              value={value}
              onChangeText={onChange}
              placeholder="Task title"
              editable={!hasConflict}
            />
          )}
        />
        <View style={themed($spacer)} />
        <Text preset="formLabel" text="Description" />
        <Controller
          control={control}
          name="description"
          render={({ field: { value, onChange } }) => (
            <TextField
              value={value}
              onChangeText={onChange}
              placeholder="Add a short summary"
              multiline
              numberOfLines={4}
              editable={!hasConflict}
            />
          )}
        />
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Priority" />
        <View style={themed($pillRow)}>
          {priorityOptions.map((priority) => (
            <Pressable
              key={priority}
              onPress={() => !hasConflict && setValue("priority", priority)}
              style={[themed($pill), priorityValue === priority && themed($pillActive)]}
            >
              <Text text={priority} />
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Assignee" />
        <View style={themed($pillRow)}>
          {assigneeOptions.map((member) => (
            <Pressable
              key={member.userId ?? "unassigned"}
              onPress={() => !hasConflict && setAssigneeUserId(member.userId)}
              style={[themed($pill), assigneeUserId === member.userId && themed($pillActive)]}
            >
              <Text text={member.label} />
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <Text preset="formLabel" text="Status" />
        <View style={themed($pillRow)}>
          {statuses.map((status) => (
            <Pressable
              key={`${status.workspaceId}:${status.projectId ?? "personal"}:${status.id}`}
              onPress={() => !hasConflict && setValue("statusId", status.id)}
              style={[themed($pill), statusValue === status.id && themed($pillActive)]}
            >
              <Text text={status.name} />
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <View style={themed($buttonRow)}>
        <Button
          text={isSaving ? "Saving..." : "Save task"}
          preset="default"
          onPress={onSubmit}
          disabled={hasConflict}
        />
        <Button text="Cancel" preset="glass" onPress={() => navigation.goBack()} />
      </View>
      <Text
        preset="formHelper"
        text={
          syncState.pendingCount > 0
            ? `Saved locally · Pending sync ${syncState.pendingCount}`
            : "Saved locally"
        }
      />
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.screenVertical,
  gap: spacing.sectionGap,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
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

const $pill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: radius.pill,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
})

const $pillActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})
