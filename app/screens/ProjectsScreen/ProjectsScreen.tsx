import { useCallback, useMemo, useState } from "react"
import { Modal, Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { useFocusEffect, useNavigation } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { ProjectsStackScreenProps } from "@/navigators/navigationTypes"
import { goToInvites } from "@/navigation/navigationActions"
import { listProjects } from "@/services/db/repositories/projectsRepository"
import { listStatuses } from "@/services/db/repositories/statusesRepository"
import { listTasksByWorkspace } from "@/services/db/repositories/tasksRepository"
import type { Workspace } from "@/services/db/types"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateTime } from "@/utils/dateFormat"

type ProjectCard = {
  workspace: Workspace
  openTasks: number
  doneTasks: number
  inProgressTasks: number
  streamsCount: number
  updatedAt: string | null
}

export function ProjectsScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<ProjectsStackScreenProps<"ProjectsHome">["navigation"]>()
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
  } = useWorkspaceStore()

  const [cards, setCards] = useState<ProjectCard[]>([])
  const [filter, setFilter] = useState<"all" | "shared" | "personal">("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [createLabel, setCreateLabel] = useState("")
  const [renameTarget, setRenameTarget] = useState<Workspace | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const loadCards = useCallback(async () => {
    const rows = await Promise.all(
      workspaces.map(async (workspace) => {
        const [tasks, statuses, streams] = await Promise.all([
          listTasksByWorkspace(workspace.id),
          listStatuses(workspace.id, null),
          listProjects(workspace.id),
        ])
        const doneIds = new Set(
          statuses.filter((status) => status.category === "done").map((status) => status.id),
        )
        const inProgressIds = new Set(
          statuses.filter((status) => status.category === "in_progress").map((status) => status.id),
        )
        const doneTasks = tasks.filter((task) => doneIds.has(task.statusId)).length
        const openTasks = tasks.length - doneTasks
        const inProgressTasks = tasks.filter((task) => inProgressIds.has(task.statusId)).length
        const updatedAt = [...tasks].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0]?.updatedAt

        return {
          workspace,
          openTasks,
          doneTasks,
          inProgressTasks,
          streamsCount: streams.length,
          updatedAt: updatedAt ?? null,
        }
      }),
    )
    setCards(rows)
  }, [workspaces])

  useFocusEffect(
    useCallback(() => {
      void loadCards()
    }, [loadCards]),
  )

  const filteredCards = useMemo(() => {
    if (filter === "personal") return cards.filter((card) => card.workspace.kind === "personal")
    if (filter === "shared") return cards.filter((card) => card.workspace.kind !== "personal")
    return cards
  }, [cards, filter])

  const totalOpen = filteredCards.reduce((sum, card) => sum + card.openTasks, 0)
  const totalActive = filteredCards.filter((card) => card.openTasks > 0).length

  const validateLabel = (label: string, excludeId?: string | null) => {
    const trimmed = label.trim()
    if (trimmed.length < 2 || trimmed.length > 40) return "Project name must be 2-40 characters."
    const normalized = trimmed.toLowerCase()
    const exists = workspaces.some(
      (workspace) =>
        workspace.id !== excludeId && workspace.label.trim().toLowerCase() === normalized,
    )
    if (exists) return "A project with that name already exists."
    return null
  }

  const handleCreate = async () => {
    const error = validateLabel(createLabel)
    if (error) {
      setFormError(error)
      return
    }
    await createWorkspace(createLabel.trim(), true)
    setCreateLabel("")
    setFormError(null)
    setCreateOpen(false)
    await loadCards()
  }

  const handleRename = async () => {
    if (!renameTarget) return
    const error = validateLabel(createLabel, renameTarget.id)
    if (error) {
      setFormError(error)
      return
    }
    await renameWorkspace(renameTarget.id, createLabel.trim())
    setCreateLabel("")
    setFormError(null)
    setRenameTarget(null)
    await loadCards()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteWorkspace(deleteTarget.id)
    setDeleteTarget(null)
    await loadCards()
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <View style={themed($headerCopy)}>
          <Text preset="overline" text="Projects" />
          <Text preset="display" text="Project hub" style={themed($title)} />
          <Text
            preset="formHelper"
            text="Manage delivery, team load, and execution views in one mobile-first workspace."
            style={themed($subtitle)}
          />
        </View>
        <Button text="New project" onPress={() => setCreateOpen(true)} />
      </View>

      <GlassCard>
        <View style={themed($statsRow)}>
          <ProjectStat label="Projects" value={`${filteredCards.length}`} />
          <ProjectStat label="Active" value={`${totalActive}`} />
          <ProjectStat label="Open tasks" value={`${totalOpen}`} />
        </View>
        <View style={themed($filterRow)}>
          {[
            { id: "all", label: "All" },
            { id: "shared", label: "Team" },
            { id: "personal", label: "Personal" },
          ].map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setFilter(option.id as typeof filter)}
              style={[themed($filterChip), filter === option.id && themed($filterChipActive)]}
            >
              <Text preset="caption" text={option.label} />
            </Pressable>
          ))}
          <Pressable onPress={goToInvites} style={themed($linkChip)}>
            <Text preset="caption" text="Invites" />
          </Pressable>
        </View>
      </GlassCard>

      <View style={themed($cardsStack)}>
        {filteredCards.map((card) => {
          const progress =
            card.openTasks + card.doneTasks === 0
              ? 0
              : card.doneTasks / (card.openTasks + card.doneTasks)
          const isActive = card.workspace.id === activeWorkspaceId

          return (
            <Pressable
              key={card.workspace.id}
              onPress={async () => {
                await setActiveWorkspaceId(card.workspace.id)
                navigation.navigate("ProjectDetail", { workspaceId: card.workspace.id })
              }}
            >
              <GlassCard style={themed(isActive ? $projectCardActive : $projectCard)}>
                <View style={themed($projectHeader)}>
                  <View style={themed($projectHeaderCopy)}>
                    <Text preset="sectionTitle" text={card.workspace.label} />
                    <Text
                      preset="formHelper"
                      text={
                        card.workspace.kind === "personal"
                          ? "Personal project"
                          : `${card.workspace.membersCount ?? 0} team members`
                      }
                    />
                  </View>
                  {isActive ? <Text preset="caption" text="Current" /> : null}
                </View>

                <View style={themed($microStatsRow)}>
                  <MiniStat label="Open" value={`${card.openTasks}`} />
                  <MiniStat label="In motion" value={`${card.inProgressTasks}`} />
                  <MiniStat label="Tracks" value={`${card.streamsCount}`} />
                </View>

                <View style={themed($progressBlock)}>
                  <View style={themed($progressTrack)}>
                    <View
                      style={[
                        themed($progressFill),
                        { width: `${Math.max(progress * 100, progress > 0 ? 12 : 0)}%` },
                      ]}
                    />
                  </View>
                  <Text
                    preset="caption"
                    text={
                      card.updatedAt
                        ? `Updated ${formatDateTime(card.updatedAt)}`
                        : "No recent activity recorded"
                    }
                  />
                </View>

                <View style={themed($projectActions)}>
                  <Button
                    text="Open"
                    preset="filled"
                    onPress={async () => {
                      await setActiveWorkspaceId(card.workspace.id)
                      navigation.navigate("ProjectDetail", { workspaceId: card.workspace.id })
                    }}
                  />
                  {card.workspace.kind !== "personal" ? (
                    <Button
                      text="Rename"
                      preset="glass"
                      onPress={() => {
                        setRenameTarget(card.workspace)
                        setCreateLabel(card.workspace.label)
                        setFormError(null)
                      }}
                    />
                  ) : null}
                  {card.workspace.kind !== "personal" ? (
                    <Button
                      text="Delete"
                      preset="reversed"
                      onPress={() => setDeleteTarget(card.workspace)}
                    />
                  ) : null}
                </View>
              </GlassCard>
            </Pressable>
          )
        })}
      </View>

      <ProjectModal
        visible={createOpen}
        title="Create project"
        value={createLabel}
        error={formError}
        confirmText="Create"
        onChangeText={(value) => {
          setCreateLabel(value)
          if (formError) setFormError(null)
        }}
        onClose={() => {
          setCreateOpen(false)
          setCreateLabel("")
          setFormError(null)
        }}
        onConfirm={handleCreate}
      />

      <ProjectModal
        visible={!!renameTarget}
        title="Rename project"
        value={createLabel}
        error={formError}
        confirmText="Save"
        onChangeText={(value) => {
          setCreateLabel(value)
          if (formError) setFormError(null)
        }}
        onClose={() => {
          setRenameTarget(null)
          setCreateLabel("")
          setFormError(null)
        }}
        onConfirm={handleRename}
      />

      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={themed($modalBackdrop)}>
          <GlassCard style={themed($modalCard)}>
            <Text preset="heading" text="Delete project?" />
            <Text
              preset="formHelper"
              text={
                deleteTarget ? `Delete ${deleteTarget.label}? This removes the project shell.` : ""
              }
            />
            <View style={themed($modalActions)}>
              <Button text="Cancel" preset="glass" onPress={() => setDeleteTarget(null)} />
              <Button text="Delete" preset="reversed" onPress={handleDelete} />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </Screen>
  )
}

function ProjectStat({ label, value }: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($statCard)}>
      <Text preset="caption" text={label} />
      <Text preset="heading" text={value} />
    </View>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($miniStat)}>
      <Text preset="caption" text={label} />
      <Text preset="subheading" text={value} />
    </View>
  )
}

function ProjectModal(props: {
  visible: boolean
  title: string
  value: string
  error: string | null
  confirmText: string
  onChangeText: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const { themed } = useAppTheme()

  return (
    <Modal visible={props.visible} transparent animationType="fade">
      <View style={themed($modalBackdrop)}>
        <GlassCard style={themed($modalCard)}>
          <Text preset="heading" text={props.title} />
          <TextField
            value={props.value}
            onChangeText={props.onChangeText}
            placeholder="Project name"
          />
          {props.error ? (
            <Text preset="formHelper" text={props.error} style={themed($errorText)} />
          ) : null}
          <View style={themed($modalActions)}>
            <Button text="Cancel" preset="glass" onPress={props.onClose} />
            <Button text={props.confirmText} onPress={props.onConfirm} />
          </View>
        </GlassCard>
      </View>
    </Modal>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.screenVertical,
  paddingBottom: spacing.xxxl,
  gap: spacing.sectionGap,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $headerCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxs,
})

const $title: ThemedStyle<TextStyle> = () => ({
  lineHeight: 40,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $statsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $statCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.md,
  gap: spacing.xxs,
})

const $filterRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
  marginTop: spacing.md,
})

const $filterChip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $filterChipActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $linkChip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $cardsStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $projectCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $projectCardActive: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  gap: spacing.md,
  borderColor: colors.primary,
})

const $projectHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.md,
  alignItems: "flex-start",
})

const $projectHeaderCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $microStatsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $miniStat: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.sm,
  gap: spacing.xxxs,
})

const $progressBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $progressTrack: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  height: 10,
  borderRadius: radius.pill,
  backgroundColor: colors.backgroundSecondary,
  overflow: "hidden",
})

const $progressFill: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  height: "100%",
  borderRadius: radius.pill,
  backgroundColor: colors.primary,
})

const $projectActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $modalBackdrop: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flex: 1,
  justifyContent: "center",
  padding: spacing.screenHorizontal,
  backgroundColor: colors.overlay,
})

const $modalCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $modalActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})
