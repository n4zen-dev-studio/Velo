import { useCallback, useMemo, useState } from "react"
import { Modal, Pressable, TextStyle, View, ViewStyle } from "react-native"
import { useFocusEffect, useNavigation } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { goToInvites } from "@/navigation/navigationActions"
import type { ProjectsStackScreenProps } from "@/navigators/navigationTypes"
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

  const activeCard = useMemo(
    () => cards.find((card) => card.workspace.id === activeWorkspaceId) ?? filteredCards[0] ?? null,
    [activeWorkspaceId, cards, filteredCards],
  )

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

  const openProject = async (workspaceId: string) => {
    await setActiveWorkspaceId(workspaceId)
    navigation.navigate("ProjectDetail", { workspaceId })
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
          <Text preset="heading" text="Project Hub" />
          <Text
            preset="caption"
            text="Jump back into active work, or manage projects without leaving mobile flow."
            style={themed($subtitle)}
          />
        </View>
        
        <Pressable onPress={() => setCreateOpen(true)} style={themed($iconAction)}>
          <Text preset="subheading" text="+" />
        </Pressable>
      </View>

      <View style={themed($topRow)}>
        <View style={themed($metricPill)}>
          <Text preset="caption" text="Projects" style={themed($metricLabel)} />
          <Text preset="subheading" text={`${filteredCards.length}`} />
        </View>
        <View style={themed($metricPill)}>
          <Text preset="caption" text="Active" style={themed($metricLabel)} />
          <Text preset="subheading" text={`${totalActive}`} />
        </View>
        <View style={themed($metricPillWide)}>
          <Text preset="caption" text="Open tasks" style={themed($metricLabel)} />
          <Text preset="subheading" text={`${totalOpen}`} />
        </View>
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
        <Pressable onPress={goToInvites} style={themed($filterChip)}>
          <Text preset="caption" text="Invites" />
        </Pressable>
      </View>

      {activeCard ? (
        <GlassCard style={themed($activeCard)}>
          <View style={themed($activeCardHeader)}>
            <View style={themed($activeCardCopy)}>
              <Text preset="caption" text="Current project" style={themed($metricLabel)} />
              <Text preset="sectionTitle" text={activeCard.workspace.label} />
              <Text
                preset="caption"
                text={
                  activeCard.updatedAt
                    ? `Updated ${formatDateTime(activeCard.updatedAt)}`
                    : "No recent activity"
                }
                style={themed($subtitle)}
              />
            </View>
            <Button text="Open board" onPress={() => void openProject(activeCard.workspace.id)} />
          </View>
          <View style={themed($miniStatsRow)}>
            <ProjectStatPill label="Open" value={`${activeCard.openTasks}`} />
            <ProjectStatPill label="In motion" value={`${activeCard.inProgressTasks}`} />
            <ProjectStatPill label="Tracks" value={`${activeCard.streamsCount}`} />
          </View>
        </GlassCard>
      ) : null}

      <View style={themed($cardsStack)}>
        {filteredCards.map((card) => {
          const isActive = card.workspace.id === activeWorkspaceId

          return (
            <CompactProjectCard
              key={card.workspace.id}
              card={card}
              isActive={isActive}
              onOpen={() => void openProject(card.workspace.id)}
              onRename={
                card.workspace.kind !== "personal"
                  ? () => {
                      setRenameTarget(card.workspace)
                      setCreateLabel(card.workspace.label)
                      setFormError(null)
                    }
                  : undefined
              }
              onDelete={
                card.workspace.kind !== "personal"
                  ? () => setDeleteTarget(card.workspace)
                  : undefined
              }
            />
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

function ProjectStatPill({ label, value }: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($projectStatPill)}>
      <Text preset="caption" text={label} style={themed($metricLabel)} />
      <Text preset="caption" text={value} />
    </View>
  )
}

function CompactProjectCard({
  card,
  isActive,
  onOpen,
  onRename,
  onDelete,
}: {
  card: ProjectCard
  isActive: boolean
  onOpen: () => void
  onRename?: () => void
  onDelete?: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable onPress={onOpen}>
      <GlassCard style={themed(isActive ? $projectCardActive : $projectCard)}>
        <View style={themed($projectRow)}>
          <View style={themed($projectMain)}>
            <View style={themed($projectTitleRow)}>
              <Text preset="formLabel" text={card.workspace.label} />
              {isActive ? (
                <Text preset="caption" text="Current" style={themed($currentBadge)} />
              ) : null}
            </View>
            <Text
              preset="caption"
              text={
                card.workspace.kind === "personal"
                  ? "Personal project"
                  : `${card.workspace.membersCount ?? 0} members · ${card.streamsCount} tracks`
              }
              style={themed($subtitle)}
            />
            <View style={themed($projectMetaRow)}>
              <ProjectStatPill label="Open" value={`${card.openTasks}`} />
              <ProjectStatPill label="Flow" value={`${card.inProgressTasks}`} />
              <ProjectStatPill label="Done" value={`${card.doneTasks}`} />
            </View>
          </View>
          <View style={themed($projectAside)}>
            <Button text="Open" preset="filled" onPress={onOpen} />
            {onRename ? <Button text="Edit" preset="glass" onPress={onRename} /> : null}
            {onDelete ? <Button text="Delete" preset="reversed" onPress={onDelete} /> : null}
          </View>
        </View>
      </GlassCard>
    </Pressable>
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
  paddingTop: spacing.md,
  paddingBottom: spacing.xxxl,
  gap: spacing.md,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $headerCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $iconAction: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: 38,
  height: 38,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  alignItems: "center",
  justifyContent: "center",
})

const $topRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $metricPill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  minHeight: 56,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  justifyContent: "center",
})

const $metricPillWide: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1.2,
  minHeight: 56,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  justifyContent: "center",
})

const $metricLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $filterRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $filterChip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $filterChipActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $activeCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $activeCardHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $activeCardCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $miniStatsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $projectStatPill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $cardsStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $projectCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $projectCardActive: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  gap: spacing.sm,
  borderColor: colors.primary,
})

const $projectRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  alignItems: "flex-start",
})

const $projectMain: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xs,
})

const $projectTitleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $currentBadge: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.primary,
})

const $projectMetaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $projectAside: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: 88,
  gap: spacing.xs,
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
