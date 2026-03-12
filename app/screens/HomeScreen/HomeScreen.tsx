import { useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, RefreshControl, TextStyle, View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { HeaderAvatar } from "@/components/HeaderAvatar"
import { PriorityDot } from "@/components/PriorityDot"
import { Screen } from "@/components/Screen"
import { SyncBadge } from "@/components/SyncBadge"
import { Text } from "@/components/Text"
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher"
import { goToInvites, goToProfile, goToProjectsTab } from "@/navigation/navigationActions"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { createHttpClient } from "@/services/api/httpClient"
import { listMyInvites } from "@/services/api/invitesApi"
import { listProjects } from "@/services/db/repositories/projectsRepository"
import type { Project, Task } from "@/services/db/types"
import { BASE_URL } from "@/config/api"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateTime } from "@/utils/dateFormat"

import { useHomeViewModel } from "./useHomeViewModel"

type FocusSection = {
  title: string
  helper: string
  tasks: Task[]
}

export function HomeScreen() {
  const { themed, theme } = useAppTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<HomeStackScreenProps<"Home">["navigation"]>()
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    uiTasksByStatus,
    activeWorkspace,
    assigneeLabels,
    refreshAll,
    isRefreshing,
  } = useHomeViewModel()

  const [pendingInvitesCount, setPendingInvitesCount] = useState(0)
  const [projectStreams, setProjectStreams] = useState<Project[]>([])

  useEffect(() => {
    let mounted = true
    void (async () => {
      if (!activeWorkspaceId) return
      const rows = await listProjects(activeWorkspaceId)
      if (mounted) setProjectStreams(rows)
    })()
    return () => {
      mounted = false
    }
  }, [activeWorkspaceId, isRefreshing])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const client = createHttpClient(BASE_URL)
        const invites = await listMyInvites(client)
        if (mounted) setPendingInvitesCount(invites.length)
      } catch {
        if (mounted) setPendingInvitesCount(0)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const allTasks = useMemo(() => uiTasksByStatus.flatMap((lane) => lane.tasks), [uiTasksByStatus])
  const doneStatusIds = useMemo(
    () =>
      new Set(
        uiTasksByStatus
          .filter((lane) => lane.status.category === "done")
          .map((lane) => lane.status.id),
      ),
    [uiTasksByStatus],
  )
  const inProgressCount = useMemo(
    () =>
      uiTasksByStatus
        .filter((lane) => lane.status.category === "in_progress")
        .reduce((sum, lane) => sum + lane.tasks.length, 0),
    [uiTasksByStatus],
  )
  const doneCount = useMemo(
    () =>
      uiTasksByStatus
        .filter((lane) => lane.status.category === "done")
        .reduce((sum, lane) => sum + lane.tasks.length, 0),
    [uiTasksByStatus],
  )
  const openCount = allTasks.length - doneCount
  const highPriorityOpen = useMemo(
    () => allTasks.filter((task) => task.priority === "high" && !doneStatusIds.has(task.statusId)),
    [allTasks, doneStatusIds],
  )
  const recentTasks = useMemo(
    () =>
      [...allTasks]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [allTasks],
  )
  const completedTasks = useMemo(
    () =>
      [...allTasks]
        .filter((task) => doneStatusIds.has(task.statusId))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3),
    [allTasks, doneStatusIds],
  )

  const focusSections = useMemo<FocusSection[]>(
    () => [
      {
        title: "Needs attention",
        helper: "High-priority items still outside done lanes.",
        tasks: highPriorityOpen.slice(0, 3),
      },
      {
        title: "In motion",
        helper: "Current work moving through in-progress lanes.",
        tasks: uiTasksByStatus
          .filter((lane) => lane.status.category === "in_progress")
          .flatMap((lane) => lane.tasks)
          .slice(0, 3),
      },
      {
        title: "Recently updated",
        helper: "Latest activity across this project.",
        tasks: recentTasks.slice(0, 3),
      },
    ],
    [highPriorityOpen, recentTasks, uiTasksByStatus],
  )

  const statusBreakdown = useMemo(() => {
    return [
      {
        label: "To do",
        value: uiTasksByStatus
          .filter((lane) => lane.status.category === "todo")
          .reduce((sum, lane) => sum + lane.tasks.length, 0),
        tone: theme.colors.warning,
      },
      { label: "In progress", value: inProgressCount, tone: theme.colors.primary },
      { label: "Done", value: doneCount, tone: theme.colors.success },
    ]
  }, [
    doneCount,
    inProgressCount,
    theme.colors.primary,
    theme.colors.success,
    theme.colors.warning,
    uiTasksByStatus,
  ])

  const maxBreakdown = Math.max(...statusBreakdown.map((item) => item.value), 1)

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
      ScrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refreshAll({ mode: "hard" })}
            tintColor={theme.colors.primary}
          />
        ),
      }}
    >
      <View style={themed($header)}>
        <View style={themed($headerLead)}>
          <HeaderAvatar onPress={goToProfile} size={52} />
          <View style={themed($headerCopy)}>
            <Text preset="overline" text="Dashboard" />
            <Text preset="display" text="Execution pulse" style={themed($title)} />
            <Text
              preset="formHelper"
              text={`Focused on ${activeWorkspace?.label ?? "your project"} right now.`}
              style={themed($subtitle)}
            />
          </View>
        </View>
        <View style={themed($headerActions)}>
          <SyncBadge />
        </View>
      </View>

      <WorkspaceSwitcher
        options={workspaces.map((workspace) => ({
          id: workspace.id,
          label: workspace.label,
          subtitle:
            workspace.kind === "personal"
              ? "Personal"
              : `${workspace.membersCount ?? 0} member${(workspace.membersCount ?? 0) === 1 ? "" : "s"}`,
        }))}
        activeId={activeWorkspaceId}
        onSelect={(id) => void setActiveWorkspaceId(id)}
      />

      <GlassCard style={themed($heroCard)}>
        <View style={themed($heroGlow)} />
        <View style={themed($heroHeader)}>
          <View>
            <Text preset="overline" text="Execution snapshot" />
            <Text preset="sectionTitle" text={activeWorkspace?.label ?? "Current project"} />
          </View>
          <Pressable onPress={goToProjectsTab} style={themed($chipAction)}>
            <Text preset="caption" text="Open projects" />
          </Pressable>
        </View>

        <View style={themed($summaryGrid)}>
          <MetricCard
            label="Active projects"
            value={`${workspaces.length}`}
            tone={theme.colors.primaryAlt}
          />
          <MetricCard label="Open tasks" value={`${openCount}`} tone={theme.colors.primary} />
          <MetricCard label="In motion" value={`${inProgressCount}`} tone={theme.colors.accent} />
          <MetricCard
            label="At risk"
            value={`${highPriorityOpen.length}`}
            tone={theme.colors.danger}
          />
        </View>

        <View style={themed($quickActions)}>
          <Button text="Create task" onPress={() => navigation.navigate("TaskEditor")} />
          <Button text="Projects hub" preset="glass" onPress={goToProjectsTab} />
          {pendingInvitesCount > 0 ? (
            <Button
              text={`Invites · ${pendingInvitesCount}`}
              preset="filled"
              onPress={goToInvites}
            />
          ) : null}
        </View>
      </GlassCard>

      <GlassCard>
        <View style={themed($sectionHeader)}>
          <View>
            <Text preset="sectionTitle" text="Progress and load" />
            <Text
              preset="formHelper"
              text={`${projectStreams.length} track${projectStreams.length === 1 ? "" : "s"} inside this project`}
            />
          </View>
          <Text preset="caption" text={`${doneCount}/${Math.max(allTasks.length, 1)} complete`} />
        </View>

        <View style={themed($breakdownStack)}>
          {statusBreakdown.map((item) => (
            <View key={item.label} style={themed($breakdownRow)}>
              <Text preset="caption" text={item.label} style={themed($breakdownLabel)} />
              <View style={themed($barTrack)}>
                <View
                  style={[
                    themed($barFill(item.tone)),
                    {
                      width: `${Math.max((item.value / maxBreakdown) * 100, item.value > 0 ? 16 : 0)}%`,
                    },
                  ]}
                />
              </View>
              <Text preset="caption" text={`${item.value}`} />
            </View>
          ))}
        </View>
      </GlassCard>

      {focusSections.map((section) => (
        <GlassCard key={section.title}>
          <View style={themed($sectionHeader)}>
            <View>
              <Text preset="sectionTitle" text={section.title} />
              <Text preset="formHelper" text={section.helper} />
            </View>
            <Text preset="caption" text={`${section.tasks.length}`} />
          </View>

          {section.tasks.length === 0 ? (
            <Text
              preset="formHelper"
              text="Nothing urgent in this view."
              style={themed($emptyText)}
            />
          ) : (
            <View style={themed($taskStack)}>
              {section.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  assigneeLabel={
                    task.assigneeUserId
                      ? (assigneeLabels[task.assigneeUserId] ?? "Assigned")
                      : "Unassigned"
                  }
                  onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                />
              ))}
            </View>
          )}
        </GlassCard>
      ))}

      <GlassCard>
        <View style={themed($sectionHeader)}>
          <View>
            <Text preset="sectionTitle" text="Recently finished" />
            <Text preset="formHelper" text="Momentum worth keeping visible." />
          </View>
        </View>
        {completedTasks.length === 0 ? (
          <Text preset="formHelper" text="No completed tasks yet." style={themed($emptyText)} />
        ) : (
          <View style={themed($taskStack)}>
            {completedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                assigneeLabel={
                  task.assigneeUserId
                    ? (assigneeLabels[task.assigneeUserId] ?? "Assigned")
                    : "Unassigned"
                }
                onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
              />
            ))}
          </View>
        )}
      </GlassCard>

      <View style={{ height: Math.max(insets.bottom, 16) + 90 }} />
    </Screen>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($metricCard)}>
      <View style={[themed($metricDot), { backgroundColor: tone }]} />
      <Text preset="caption" text={label} style={themed($metricLabel)} />
      <Text preset="heading" text={value} />
    </View>
  )
}

function TaskRow({
  task,
  assigneeLabel,
  onPress,
}: {
  task: Task
  assigneeLabel: string
  onPress: () => void
}) {
  const { themed } = useAppTheme()
  const updatedLabel = useMemo(() => formatDateTime(task.updatedAt), [task.updatedAt])

  return (
    <Pressable onPress={onPress} style={themed($taskCard)}>
      <View style={themed($taskHeader)}>
        <View style={themed($taskTitleRow)}>
          <PriorityDot priority={task.priority} />
          <Text preset="formLabel" text={task.title} style={themed($taskTitle)} />
        </View>
        <Text preset="caption" text={task.priority.toUpperCase()} />
      </View>
      {!!task.description ? (
        <Text
          preset="formHelper"
          text={task.description}
          numberOfLines={2}
          style={themed($taskDescription)}
        />
      ) : null}
      <View style={themed($taskMetaRow)}>
        <Text preset="caption" text={assigneeLabel} />
        <Text preset="caption" text={updatedLabel} />
      </View>
    </Pressable>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.screenVertical,
  paddingBottom: spacing.xxxl,
  gap: spacing.sectionGap,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.md,
  alignItems: "flex-start",
})

const $headerLead: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  flexDirection: "row",
  gap: spacing.md,
})

const $headerCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $headerActions: ThemedStyle<ViewStyle> = () => ({
  alignItems: "flex-end",
})

const $title: ThemedStyle<TextStyle> = () => ({
  lineHeight: 40,
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $heroCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginHorizontal: spacing.screenHorizontal,
  overflow: "hidden",
})

const $heroGlow: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute",
  width: 180,
  height: 180,
  borderRadius: 999,
  backgroundColor: colors.glowStrong,
  top: -52,
  right: -32,
})

const $heroHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.md,
  alignItems: "flex-start",
  marginBottom: spacing.md,
})

const $chipAction: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderStrong,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
})

const $summaryGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $metricCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  width: "47%",
  minWidth: 140,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.md,
  gap: spacing.xxs,
})

const $metricDot: ThemedStyle<ViewStyle> = ({ radius }) => ({
  width: 8,
  height: 8,
  borderRadius: radius.pill,
})

const $metricLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $quickActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.lg,
  gap: spacing.sm,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing.sm,
  marginBottom: spacing.md,
})

const $breakdownStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $breakdownRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $breakdownLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  width: 76,
  color: colors.textMuted,
})

const $barTrack: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  flex: 1,
  height: 10,
  borderRadius: radius.pill,
  backgroundColor: colors.backgroundSecondary,
  overflow: "hidden",
})

const $barFill =
  (backgroundColor: string): ThemedStyle<ViewStyle> =>
  ({ radius }) => ({
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor,
  })

const $taskStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $taskCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.md,
  gap: spacing.xs,
})

const $taskHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
})

const $taskTitleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  flex: 1,
})

const $taskTitle: ThemedStyle<TextStyle> = () => ({
  flex: 1,
})

const $taskDescription: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $taskMetaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $emptyText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})
