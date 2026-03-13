import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  Image,
  ImageStyle,
  Platform,
  Pressable,
  ScrollView,
  View,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from "react-native"
import * as DocumentPicker from "expo-document-picker"
import * as ImagePicker from "expo-image-picker"
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { useNavigation, useRoute } from "@react-navigation/native"
import { Controller, useForm } from "react-hook-form"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { z } from "zod"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { goToConflictResolution } from "@/navigation/navigationActions"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { hasOpenConflict } from "@/services/db/repositories/conflictsRepository"
import type { TaskAttachment } from "@/services/db/types"
import { generateUuidV4 } from "@/services/sync/identity"
import { useSyncStatus } from "@/services/sync/syncStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateTime } from "@/utils/dateFormat"

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
    attachments,
    setAttachments,
  } = useTaskEditorViewModel(taskId, projectId)
  const syncState = useSyncStatus()
  const [hasConflict, setHasConflict] = useState(false)
  const [pickerField, setPickerField] = useState<"startDate" | "endDate" | null>(null)
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
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
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

  const { control, handleSubmit, setValue, watch, reset } = useForm<{
    title: string
    description: string
    statusId: string
    priority: "low" | "medium" | "high"
    startDate: string | null
    endDate: string | null
  }>({
    defaultValues,
    resolver,
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const priorityValue = watch("priority")
  const statusValue = watch("statusId")
  const startDateValue = watch("startDate")
  const endDateValue = watch("endDate")

  const addImageAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo library access to attach images to tasks.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsMultipleSelection: false,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    const now = new Date().toISOString()
    const nextAttachment: TaskAttachment = {
      id: await generateUuidV4(),
      taskId: task?.id ?? "",
      workspaceId: task?.workspaceId ?? activeWorkspaceId ?? "",
      fileName: asset.fileName ?? `image-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
      localUri: asset.uri,
      remoteUri: null,
      fileSize: asset.fileSize ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      scopeKey: task?.scopeKey ?? "",
    }
    setAttachments((prev) => [...prev, nextAttachment])
  }

  const addPdfAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const now = new Date().toISOString()
    const nextAttachment: TaskAttachment = {
      id: await generateUuidV4(),
      taskId: task?.id ?? "",
      workspaceId: task?.workspaceId ?? activeWorkspaceId ?? "",
      fileName: asset.name ?? `document-${Date.now()}.pdf`,
      mimeType: asset.mimeType ?? "application/pdf",
      localUri: asset.uri,
      remoteUri: null,
      fileSize: asset.size ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      scopeKey: task?.scopeKey ?? "",
    }
    setAttachments((prev) => [...prev, nextAttachment])
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId))
  }

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
          <View style={themed($headerTitleRow)}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons
                name={"arrow-back"}
                size={25}
                color={theme.colors.text}
                style={themed($headerBackIcon)}
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
                onPress={() => goToConflictResolution({ conflictId: `task:${taskId ?? ""}` })}
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

        <GlassCard style={themed($selectorsCard)}>
          <CompactSectionLabel text="Dates" />
          <View style={themed($dateRow)}>
            <DateChip
              label="Start date"
              value={startDateValue}
              onPress={() => !hasConflict && setPickerField("startDate")}
              onClear={startDateValue ? () => setValue("startDate", null) : undefined}
            />
            <DateChip
              label="End date"
              value={endDateValue}
              onPress={() => !hasConflict && setPickerField("endDate")}
              onClear={endDateValue ? () => setValue("endDate", null) : undefined}
            />
          </View>
        </GlassCard>

        <GlassCard style={themed($selectorsCard)}>
          <CompactSectionLabel text="Attachments" />
          <View style={themed($pillRow)}>
            <Pressable onPress={() => void addImageAttachment()} style={themed($pill)}>
              <Text preset="caption" text="Add image" style={themed($pillText)} />
            </Pressable>
            <Pressable onPress={() => void addPdfAttachment()} style={themed($pill)}>
              <Text preset="caption" text="Add PDF" style={themed($pillText)} />
            </Pressable>
          </View>
          {attachments.length > 0 ? (
            <View style={themed($attachmentStack)}>
              {attachments.map((attachment) => (
                <View key={attachment.id} style={themed($attachmentRow)}>
                  <View style={themed($attachmentPreview)}>
                    {attachment.mimeType.startsWith("image/") ? (
                      <Image
                        source={{ uri: attachment.localUri }}
                        style={themed($attachmentThumb)}
                      />
                    ) : (
                      <View style={themed($pdfIcon)}>
                        <Text preset="caption" text="PDF" style={themed($strongPillText)} />
                      </View>
                    )}
                  </View>
                  <View style={themed($attachmentCopy)}>
                    <Text preset="caption" text={attachment.fileName} numberOfLines={1} />
                    <Text
                      preset="caption"
                      text={
                        attachment.fileSize
                          ? `${Math.round(attachment.fileSize / 1024)} KB`
                          : "Local attachment"
                      }
                      style={themed($subtitle)}
                    />
                  </View>
                  <Pressable
                    onPress={() => removeAttachment(attachment.id)}
                    style={themed($removeButton)}
                  >
                    <Ionicons name="close" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text
              preset="caption"
              text="Attach images or PDFs to keep task context close to the work."
              style={themed($subtitle)}
            />
          )}
        </GlassCard>
      </ScrollView>

      {pickerField ? (
        <View style={themed($pickerWrap)}>
          <DateTimePicker
            value={
              new Date((pickerField === "startDate" ? startDateValue : endDateValue) ?? Date.now())
            }
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_, selectedDate) => {
              if (Platform.OS !== "ios") {
                setPickerField(null)
              }
              if (!selectedDate) return
              setValue(pickerField, selectedDate.toISOString())
            }}
          />
          {Platform.OS === "ios" ? (
            <Button text="Done" preset="glass" onPress={() => setPickerField(null)} />
          ) : null}
        </View>
      ) : null}

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

function DateChip(props: {
  label: string
  value: string | null | undefined
  onPress: () => void
  onClear?: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable onPress={props.onPress} style={themed($dateChip)}>
      <Text preset="caption" text={props.label} style={themed($subtitle)} />
      <Text
        preset="caption"
        text={props.value ? formatDateTime(props.value) : "Set date"}
        style={themed(props.value ? $strongText : $pillText)}
      />
      {props.onClear ? (
        <Pressable onPress={props.onClear} style={themed($clearChipButton)}>
          <Ionicons name="close-circle" size={14} color="#A9A3C5" />
        </Pressable>
      ) : null}
    </Pressable>
  )
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

const $headerTitleRow: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row",
  alignItems: "center",
})

const $headerBackIcon: ThemedStyle<TextStyle> = ({ spacing }) => ({
  padding: spacing.xxs + 1,
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

const $dateRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
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

const $strongPillText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textInverse,
})

const $strongText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontWeight: "600",
})

const $sectionLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  textTransform: "uppercase",
})

const $compactButtonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  gap: spacing.xs,
})

const $dateChip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.large,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.xxxs,
})

const $clearChipButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  position: "absolute",
  right: spacing.sm,
  top: spacing.sm,
})

const $attachmentStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $attachmentRow: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  borderRadius: radius.large,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.sm,
})

const $attachmentPreview: ThemedStyle<ViewStyle> = () => ({
  width: 42,
  height: 42,
  overflow: "hidden",
  borderRadius: 12,
})

const $attachmentThumb: ThemedStyle<ImageStyle> = () => ({
  width: "100%",
  height: "100%",
})

const $pdfIcon: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: "100%",
  height: "100%",
  borderRadius: radius.medium,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.primary,
})

const $attachmentCopy: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $removeButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.xxs,
})

const $pickerWrap: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderTopWidth: 1,
  borderTopColor: colors.borderSubtle,
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.sm,
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
