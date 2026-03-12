import { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, View, ViewStyle, TextStyle, TouchableOpacity } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import { Controller, useForm } from "react-hook-form"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { z } from "zod"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { hasOpenConflict } from "@/services/db/repositories/conflictsRepository"
import { useSyncStatus } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { Ionicons } from "@expo/vector-icons"

import { useTaskEditorViewModel } from "./useTaskEditorViewModel"

export function TaskEditorScreen() {
  const { themed, theme } = useAppTheme()
  const insets = useSafeAreaInsets()
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
    if (task) {
      navigation.replace("TaskDetail", { taskId: saved.id })
      return
    }
    navigation.goBack()
  })

  return (
    <Screen
      preset="fixed"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <View style={themed($headerCopy)}>
          <Text preset="overline" text={task ? "Edit task" : "Create task"} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons
                name={"arrow-back"}
                size={25}
                color={theme.colors.text}
                style={{ padding: 5 }}
              />
            </TouchableOpacity>

            <Text preset="heading" text={task ? "Update task" : "New task"} />
          </View>
          <Text preset="caption" text={`Project: ${workspaceLabel}`} style={themed($subtitle)} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          themed($content),
          { paddingBottom: Math.max(insets.bottom, 16) + 116 },
        ]}
      >
        {hasConflict ? (
          <GlassCard>
            <Text preset="subheading" text="Editing locked" />
            <Text
              preset="formHelper"
              text="This item has a sync conflict and must be resolved before editing."
            />
            <View style={themed($compactButtonRow)}>
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

        <GlassCard style={themed($detailsCard)}>
          <CompactSectionLabel text="Task details" />
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange } }) => (
              <View style={themed($fieldGroup)}>
                <Text preset="formLabel" text="Title" />
                <TextField
                  value={value}
                  onChangeText={onChange}
                  placeholder="Task title"
                  editable={!hasConflict}
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange } }) => (
              <View style={themed($fieldGroup)}>
                <Text preset="formLabel" text="Description" />
                <TextField
                  value={value}
                  onChangeText={onChange}
                  placeholder="Add a short summary"
                  multiline
                  numberOfLines={3}
                  editable={!hasConflict}
                  style={themed($descriptionField)}
                />
              </View>
            )}
          />
        </GlassCard>

        <GlassCard style={themed($selectorsCard)}>
          <CompactSectionLabel text="Workflow" />
          <CompactSelectorSection
            title="Priority"
            items={priorityOptions.map((priority) => ({
              id: priority,
              label: priority[0].toUpperCase() + priority.slice(1),
              selected: priorityValue === priority,
              onPress: () => !hasConflict && setValue("priority", priority),
            }))}
          />

          <CompactSelectorSection
            title="Assignee"
            items={assigneeOptions.map((member) => ({
              id: member.userId ?? "unassigned",
              label: member.label,
              selected: assigneeUserId === member.userId,
              onPress: () => !hasConflict && setAssigneeUserId(member.userId),
            }))}
          />

          <CompactSelectorSection
            title="Status"
            items={statuses.map((status) => ({
              id: `${status.workspaceId}:${status.projectId ?? "personal"}:${status.id}`,
              label: status.name,
              selected: statusValue === status.id,
              onPress: () => !hasConflict && setValue("statusId", status.id),
            }))}
          />
        </GlassCard>
      </ScrollView>

      <View style={[themed($actionBar), { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text
          preset="caption"
          text={
            syncState.pendingCount > 0
              ? `Saved locally · ${syncState.pendingCount} pending sync`
              : "Saved locally"
          }
          style={themed($subtitle)}
        />
        <View style={themed($actionRow)}>
          <Button
            text={isSaving ? "Saving..." : "Save task"}
            preset="default"
            onPress={onSubmit}
            disabled={hasConflict}
            style={themed($primaryAction)}
          />
          <Button text="Cancel" preset="glass" onPress={() => navigation.goBack()} />
        </View>
      </View>
    </Screen>
  )
}

function CompactSelectorSection(props: {
  title: string
  items: Array<{ id: string; label: string; selected: boolean; onPress: () => void }>
}) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($selectorSection)}>
      <Text preset="formLabel" text={props.title} />
      <View style={themed($pillRow)}>
        {props.items.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            style={[themed($pill), item.selected && themed($pillActive)]}
          >
            <Text preset="caption" text={item.label} style={themed($pillText)} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function CompactSectionLabel({ text }: { text: string }) {
  const { themed } = useAppTheme()
  return <Text preset="caption" text={text} style={themed($sectionLabel)} />
}

const $screen: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.md,
  paddingBottom: spacing.sm,
})

const $headerCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxxs,
})

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  gap: spacing.sm,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $detailsCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $selectorsCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $fieldGroup: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $descriptionField: ThemedStyle<ViewStyle> = () => ({
  minHeight: 92,
})

const $selectorSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $pillRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $pill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  minHeight: 36,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: radius.pill,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  alignItems: "center",
  justifyContent: "center",
})

const $pillActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $pillText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $sectionLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textTransform: "uppercase",
})

const $compactButtonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  gap: spacing.xs,
})

const $actionBar: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderTopWidth: 1,
  borderTopColor: colors.borderSubtle,
  backgroundColor: colors.background,
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.sm,
  gap: spacing.xs,
})

const $actionRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $primaryAction: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})
