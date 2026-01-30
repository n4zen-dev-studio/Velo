import { useEffect, useState } from "react"
import { Pressable, View, ViewStyle } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"

import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import {
  getConflict,
  resolveConflictKeepLocal,
  resolveConflictMerge,
  resolveConflictUseRemote,
} from "@/services/db/repositories/conflictsRepository"
import type { Comment, Task } from "@/services/db/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function ConflictResolutionScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<AppStackScreenProps<"ConflictResolution">["navigation"]>()
  const route = useRoute<AppStackScreenProps<"ConflictResolution">["route"]>()
  const { entityType, entityId } = route.params

  const [localPayload, setLocalPayload] = useState<Task | Comment | null>(null)
  const [remotePayload, setRemotePayload] = useState<Task | Comment | null>(null)
  const [mergePayload, setMergePayload] = useState<Task | Comment | null>(null)

  useEffect(() => {
    getConflict(entityType, entityId).then((conflict) => {
      if (!conflict) return
      const local = JSON.parse(conflict.localPayload) as Task | Comment
      const remote = JSON.parse(conflict.remotePayload) as Task | Comment
      setLocalPayload(local)
      setRemotePayload(remote)
      setMergePayload({ ...local })
    })
  }, [entityType, entityId])

  if (!localPayload || !remotePayload || !mergePayload) {
    return (
      <Screen preset="fixed" contentContainerStyle={themed($screen)}>
        <Text preset="formHelper" text="Loading conflict..." />
      </Screen>
    )
  }

  const handleResolve = async (mode: "local" | "remote" | "merge") => {
    if (mode === "local") {
      await resolveConflictKeepLocal(entityType, entityId)
    }
    if (mode === "remote") {
      await resolveConflictUseRemote(entityType, entityId)
    }
    if (mode === "merge") {
      await resolveConflictMerge(entityType, entityId, mergePayload)
    }
    navigation.goBack()
  }

  const renderFields = (payload: Task | Comment) => {
    if (entityType === "comment") {
      const comment = payload as Comment
      return (
        <>
          <Text preset="formLabel" text="Body" />
          <Text preset="formHelper" text={comment.body} />
          <Text preset="formHelper" text={`Task: ${comment.taskId}`} />
          <Text preset="formHelper" text={`Updated: ${comment.updatedAt}`} />
        </>
      )
    }

    const task = payload as Task
    return (
      <>
        <Text preset="formLabel" text="Title" />
        <Text preset="formHelper" text={task.title} />
        <Text preset="formHelper" text={`Status: ${task.statusId}`} />
        <Text preset="formHelper" text={`Priority: ${task.priority}`} />
        <Text preset="formHelper" text={`Assignee: ${task.assigneeUserId ?? "Unassigned"}`} />
        <Text preset="formHelper" text={`Updated: ${task.updatedAt}`} />
        <Text preset="formLabel" text="Description" />
        <Text preset="formHelper" text={task.description} />
      </>
    )
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Resolve Conflict" />
        <Text preset="formHelper" text={`${entityType} · ${entityId}`} />
      </View>

      <View style={themed($grid)}>
        <GlassCard>
          <Text preset="subheading" text="Local version" />
          {renderFields(localPayload)}
        </GlassCard>
        <GlassCard>
          <Text preset="subheading" text="Remote version" />
          {renderFields(remotePayload)}
        </GlassCard>
      </View>

      <GlassCard>
        <Text preset="subheading" text="Manual merge" />
        {entityType === "task" ? (
          <>
            <Text preset="formLabel" text="Title" />
            <TextField
              value={(mergePayload as Task).title}
              onChangeText={(value) =>
                setMergePayload((prev) => ({ ...(prev as Task), title: value }))
              }
            />
            <Text preset="formLabel" text="Description" />
            <TextField
              value={(mergePayload as Task).description}
              onChangeText={(value) =>
                setMergePayload((prev) => ({ ...(prev as Task), description: value }))
              }
              multiline
              numberOfLines={4}
            />
            <Text preset="formLabel" text="Status" />
            <TextField
              value={(mergePayload as Task).statusId}
              onChangeText={(value) =>
                setMergePayload((prev) => ({ ...(prev as Task), statusId: value }))
              }
            />
            <Text preset="formLabel" text="Priority" />
            <TextField
              value={(mergePayload as Task).priority}
              onChangeText={(value) =>
                setMergePayload((prev) => ({ ...(prev as Task), priority: value }))
              }
            />
            <Text preset="formLabel" text="Assignee" />
            <TextField
              value={(mergePayload as Task).assigneeUserId ?? ""}
              onChangeText={(value) =>
                setMergePayload((prev) => ({ ...(prev as Task), assigneeUserId: value || null }))
              }
            />
          </>
        ) : (
          <>
            <Text preset="formLabel" text="Body" />
            <TextField
              value={(mergePayload as Comment).body}
              onChangeText={(value) =>
                setMergePayload((prev) => ({ ...(prev as Comment), body: value }))
              }
              multiline
              numberOfLines={4}
            />
          </>
        )}
        <Pressable style={themed($button)} onPress={() => handleResolve("merge")}
        >
          <Text preset="formLabel" text="Save merged" />
        </Pressable>
      </GlassCard>

      <View style={themed($actions)}>
        <Pressable style={themed($button)} onPress={() => handleResolve("local")}>
          <Text preset="formLabel" text="Keep local" />
        </Pressable>
        <Pressable style={themed($button)} onPress={() => handleResolve("remote")}>
          <Text preset="formLabel" text="Use remote" />
        </Pressable>
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

const $grid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $actions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $button: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: spacing.sm,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  backgroundColor: colors.palette.neutral100,
  marginTop: spacing.sm,
})
