import { useEffect, useMemo, useState } from "react"
import { Pressable, RefreshControl, TextStyle, View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GlassCard } from "@/components/GlassCard"
import { HeaderAvatar } from "@/components/HeaderAvatar"
import { PriorityDot } from "@/components/PriorityDot"
import { Screen } from "@/components/Screen"
import { SyncBadge } from "@/components/SyncBadge"
import { Text } from "@/components/Text"
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

type ActivityItem = {
  id: string
  title: string
  meta: string
  tone: string
}

type AlertItem = {
  id: string
  label: string
  count: number
  tone: string
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

  const todoCount = useMemo(
    () =>
      uiTasksByStatus
        .filter((lane) => lane.status.category === "todo")
        .reduce((sum, lane) => sum + lane.tasks.length, 0),
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

  const openCount = Math.max(allTasks.length - doneCount, 0)
  const highPriorityOpen = useMemo(
    () => allTasks.filter((task) => task.priority === "high" && !doneStatusIds.has(task.statusId)),
    [allTasks, doneStatusIds],
  )

  const recentTasks = useMemo(
    () =>
      [...allTasks]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
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

  const activeProjectsCount = useMemo(
    () =>
      workspaces.filter(
        (workspace) => workspace.kind !== "personal" || workspace.id === activeWorkspaceId,
      ).length,
    [activeWorkspaceId, workspaces],
  )

  const statusBreakdown = useMemo(
    () => [
      { label: "To do", value: todoCount, tone: theme.colors.warning },
      { label: "In progress", value: inProgressCount, tone: theme.colors.primary },
      { label: "Done", value: doneCount, tone: theme.colors.success },
    ],
    [
      doneCount,
      inProgressCount,
      theme.colors.primary,
      theme.colors.success,
      theme.colors.warning,
      todoCount,
    ],
  )

  const totalBreakdown = Math.max(
    statusBreakdown.reduce((sum, item) => sum + item.value, 0),
    1,
  )
  const maxBar = Math.max(...statusBreakdown.map((item) => item.value), 1)

  const activityItems = useMemo<ActivityItem[]>(
    () =>
      recentTasks.map((task) => ({
        id: task.id,
        title: task.title,
        meta: `${
          task.assigneeUserId ? (assigneeLabels[task.assigneeUserId] ?? "Assigned") : "Unassigned"
        } · ${formatDateTime(task.updatedAt)}`,
        tone:
          task.priority === "high"
            ? theme.colors.danger
            : task.priority === "medium"
              ? theme.colors.warning
              : theme.colors.accent,
      })),
    [assigneeLabels, recentTasks, theme.colors.accent, theme.colors.danger, theme.colors.warning],
  )

  const alertItems = useMemo<AlertItem[]>(
    () => [
      {
        id: "risk",
        label: "At risk",
        count: highPriorityOpen.length,
        tone: theme.colors.danger,
      },
      {
        id: "review",
        label: "Waiting review",
        count: inProgressCount,
        tone: theme.colors.primary,
      },
      {
        id: "done",
        label: "Completed recently",
        count: completedTasks.length,
        tone: theme.colors.success,
      },
    ],
    [
      completedTasks.length,
      highPriorityOpen.length,
      inProgressCount,
      theme.colors.danger,
      theme.colors.primary,
      theme.colors.success,
    ],
  )

  const agendaRows = useMemo(() => {
    const today = recentTasks.slice(0, 2)
    const tomorrow = highPriorityOpen.slice(0, 2)
    const thisWeek = [...allTasks].filter((task) => !doneStatusIds.has(task.statusId)).slice(0, 3)

    return [
      { label: "Today", tasks: today },
      { label: "Tomorrow", tasks: tomorrow },
      { label: "This week", tasks: thisWeek },
    ]
  }, [allTasks, doneStatusIds, highPriorityOpen, recentTasks])

  const statCards = [
    {
      label: "Active Projects",
      value: `${Math.max(activeProjectsCount, 1)}`,
      tone: theme.colors.primaryAlt,
    },
    {
      label: "Open Tasks",
      value: `${openCount}`,
      tone: theme.colors.primary,
    },
    {
      label: "In Motion",
      value: `${inProgressCount}`,
      tone: theme.colors.accent,
    },
    {
      label: "At Risk",
      value: `${highPriorityOpen.length}`,
      tone: theme.colors.danger,
    },
  ]

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
        <View style={themed($headerTopRow)}>
          <View style={themed($headerLead)}>
            <HeaderAvatar onPress={goToProfile} size={40} />
            <View style={themed($headerTitleWrap)}>
              <Text preset="sectionTitle" text="Dashboard" style={themed($headerTitle)} />
              <Text
                preset="caption"
                text={activeWorkspace?.kind === "personal" ? "Personal project" : "Project view"}
                style={themed($headerCaption)}
              />
            </View>
          </View>
          <SyncBadge />
        </View>

        <View style={themed($headerMetaRow)}>
          <Pressable onPress={goToProjectsTab} style={themed($workspacePill)}>
            <Text
              preset="caption"
              text={activeWorkspace?.label ?? "Personal"}
              numberOfLines={1}
              style={themed($workspacePillText)}
            />
          </Pressable>

          <View style={themed($statusPill)}>
            <View style={themed($statusDot)} />
            <Text preset="caption" text={isRefreshing ? "Refreshing" : "Idle"} />
          </View>
        </View>

        <View style={themed($switcherRow)}>
          {workspaces.slice(0, 4).map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId
            return (
              <Pressable
                key={workspace.id}
                onPress={() => void setActiveWorkspaceId(workspace.id)}
                style={[themed($switchChip), isActive && themed($switchChipActive)]}
              >
                <Text preset="caption" text={workspace.label} numberOfLines={1} />
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={themed($content)}>
        <View style={themed($statsGrid)}>
          {statCards.map((card) => (
            <DashboardStatCard
              key={card.label}
              label={card.label}
              value={card.value}
              tone={card.tone}
            />
          ))}
        </View>

        <GlassCard style={themed($chartCard)}>
          <View style={themed($compactSectionHeader)}>
            <Text preset="formLabel" text="Task status" />
            <Text
              preset="caption"
              text={`${doneCount}/${Math.max(allTasks.length, 1)} complete`}
              style={themed($mutedText)}
            />
          </View>

          <View style={themed($distributionBar)}>
            {statusBreakdown.map((item) => (
              <View
                key={item.label}
                style={[
                  themed($distributionSlice(item.tone)),
                  { flex: Math.max(item.value, item.value === 0 ? 0.5 : item.value) },
                ]}
              />
            ))}
          </View>

          <View style={themed($chartLegend)}>
            {statusBreakdown.map((item) => (
              <MiniChartLegend
                key={item.label}
                label={item.label}
                value={item.value}
                tone={item.tone}
                percent={Math.round((item.value / totalBreakdown) * 100)}
              />
            ))}
          </View>

          <View style={themed($miniBarsRow)}>
            {statusBreakdown.map((item) => (
              <View key={item.label} style={themed($miniBarColumn)}>
                <View style={themed($miniBarTrack)}>
                  <View
                    style={[
                      themed($miniBarFill(item.tone)),
                      {
                        height: `${Math.max((item.value / maxBar) * 100, item.value > 0 ? 14 : 0)}%`,
                      },
                    ]}
                  />
                </View>
                <Text
                  preset="caption"
                  text={item.label.split(" ")[0]}
                  style={themed($miniBarLabel)}
                />
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard style={themed($actionsCard)}>
          <View style={themed($compactSectionHeader)}>
            <Text preset="formLabel" text="Quick actions" />
            {pendingInvitesCount > 0 ? (
              <Text
                preset="caption"
                text={`${pendingInvitesCount} invites`}
                style={themed($mutedText)}
              />
            ) : null}
          </View>
          <View style={themed($quickActionsRow)}>
            <CompactAction label="Create task" onPress={() => navigation.navigate("TaskEditor")} />
            <CompactAction label="Create project" onPress={goToProjectsTab} />
            <CompactAction label="Assign task" onPress={goToProjectsTab} />
            {pendingInvitesCount > 0 ? (
              <CompactAction label="Invites" onPress={goToInvites} />
            ) : null}
          </View>
        </GlassCard>

        <View style={themed($twoColumnRow)}>
          <GlassCard style={themed($halfCard)}>
            <View style={themed($compactSectionHeader)}>
              <Text preset="formLabel" text="Recent activity" />
              <Text preset="caption" text={`${activityItems.length}`} style={themed($mutedText)} />
            </View>
            <View style={themed($tightStack)}>
              {activityItems.length === 0 ? (
                <Text preset="caption" text="No recent activity." style={themed($mutedText)} />
              ) : (
                activityItems.slice(0, 4).map((item) => <ActivityRow key={item.id} item={item} />)
              )}
            </View>
          </GlassCard>

          <GlassCard style={themed($halfCard)}>
            <View style={themed($compactSectionHeader)}>
              <Text preset="formLabel" text="Attention" />
              <Text
                preset="caption"
                text={`${projectStreams.length} tracks`}
                style={themed($mutedText)}
              />
            </View>
            <View style={themed($tightStack)}>
              {alertItems.map((item) => (
                <AlertRow key={item.id} item={item} />
              ))}
            </View>
          </GlassCard>
        </View>

        <GlassCard>
          <View style={themed($compactSectionHeader)}>
            <Text preset="formLabel" text="Upcoming work" />
            <Text preset="caption" text="Agenda" style={themed($mutedText)} />
          </View>
          <View style={themed($tightStack)}>
            {agendaRows.map((row) => (
              <AgendaRow
                key={row.label}
                label={row.label}
                tasks={row.tasks}
                assigneeLabels={assigneeLabels}
                onPressTask={(taskId) => navigation.navigate("TaskDetail", { taskId })}
              />
            ))}
          </View>
        </GlassCard>

        <View style={{ height: Math.max(insets.bottom, 14) + 88 }} />
      </View>
    </Screen>
  )
}

function DashboardStatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($statCard)}>
      <View style={themed($statTopRow)}>
        <View style={[themed($statDot), { backgroundColor: tone }]} />
        <Text preset="caption" text={label} style={themed($statLabel)} />
      </View>
      <Text preset="subheading" text={value} style={themed($statValue)} />
    </View>
  )
}

function MiniChartLegend({
  label,
  value,
  tone,
  percent,
}: {
  label: string
  value: number
  tone: string
  percent: number
}) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($legendItem)}>
      <View style={[themed($legendDot), { backgroundColor: tone }]} />
      <View style={themed($legendCopy)}>
        <Text preset="caption" text={label} style={themed($legendLabel)} />
        <Text preset="caption" text={`${value} · ${percent}%`} style={themed($legendValue)} />
      </View>
    </View>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($rowCard)}>
      <View style={[themed($rowMarker), { backgroundColor: item.tone }]} />
      <View style={themed($rowCopy)}>
        <Text preset="caption" text={item.title} numberOfLines={1} style={themed($rowTitle)} />
        <Text preset="caption" text={item.meta} numberOfLines={1} style={themed($rowMeta)} />
      </View>
    </View>
  )
}

function AlertRow({ item }: { item: AlertItem }) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($alertRow)}>
      <View style={themed($alertLead)}>
        <View style={[themed($alertDot), { backgroundColor: item.tone }]} />
        <Text preset="caption" text={item.label} style={themed($rowTitle)} />
      </View>
      <Text preset="caption" text={`${item.count}`} style={themed($rowMeta)} />
    </View>
  )
}

function AgendaRow({
  label,
  tasks,
  assigneeLabels,
  onPressTask,
}: {
  label: string
  tasks: Task[]
  assigneeLabels: Record<string, string>
  onPressTask: (taskId: string) => void
}) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($agendaRow)}>
      <Text preset="caption" text={label} style={themed($agendaLabel)} />
      <View style={themed($agendaItems)}>
        {tasks.length === 0 ? (
          <Text preset="caption" text="Nothing queued" style={themed($mutedText)} />
        ) : (
          tasks.slice(0, 2).map((task) => (
            <Pressable
              key={task.id}
              onPress={() => onPressTask(task.id)}
              style={themed($agendaItem)}
            >
              <View style={themed($agendaTitleRow)}>
                <PriorityDot priority={task.priority} />
                <Text
                  preset="caption"
                  text={task.title}
                  numberOfLines={1}
                  style={themed($rowTitle)}
                />
              </View>
              <Text
                preset="caption"
                text={
                  task.assigneeUserId
                    ? (assigneeLabels[task.assigneeUserId] ?? "Assigned")
                    : "Unassigned"
                }
                numberOfLines={1}
                style={themed($rowMeta)}
              />
            </Pressable>
          ))
        )}
      </View>
    </View>
  )
}

function CompactAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { themed } = useAppTheme()

  return (
    <Pressable onPress={onPress} style={themed($actionPill)}>
      <Text preset="caption" text={`+ ${label}`} style={themed($actionText)} />
    </Pressable>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.md,
  paddingBottom: spacing.xxl,
})

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  gap: spacing.md,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingBottom: spacing.sm,
  gap: spacing.sm,
})

const $headerTopRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $headerLead: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  flex: 1,
})

const $headerTitleWrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: 2,
  flex: 1,
})

const $headerTitle: ThemedStyle<TextStyle> = () => ({
  lineHeight: 22,
})

const $headerCaption: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $headerMetaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $workspacePill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $workspacePillText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $statusPill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $statusDot: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: 6,
  height: 6,
  borderRadius: radius.pill,
  backgroundColor: colors.success,
})

const $switcherRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $switchChip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  minHeight: 32,
  justifyContent: "center",
})

const $switchChipActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $statsGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $statCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  width: "47.5%",
  minHeight: 78,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  justifyContent: "space-between",
})

const $statTopRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $statDot: ThemedStyle<ViewStyle> = ({ radius }) => ({
  width: 7,
  height: 7,
  borderRadius: radius.pill,
})

const $statLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
  flex: 1,
})

const $statValue: ThemedStyle<TextStyle> = () => ({
  lineHeight: 24,
})

const $chartCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $compactSectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
})

const $mutedText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $distributionBar: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  flexDirection: "row",
  height: 12,
  borderRadius: radius.pill,
  backgroundColor: colors.backgroundSecondary,
  overflow: "hidden",
})

const $distributionSlice =
  (backgroundColor: string): ThemedStyle<ViewStyle> =>
  ({}) => ({
    backgroundColor,
    height: "100%",
  })

const $chartLegend: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $legendItem: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "47%",
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $legendDot: ThemedStyle<ViewStyle> = ({ radius }) => ({
  width: 8,
  height: 8,
  borderRadius: radius.pill,
})

const $legendCopy: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $legendLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $legendValue: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $miniBarsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $miniBarColumn: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  alignItems: "center",
  gap: spacing.xs,
})

const $miniBarTrack: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: "100%",
  height: 44,
  borderRadius: radius.medium,
  backgroundColor: colors.backgroundSecondary,
  justifyContent: "flex-end",
  overflow: "hidden",
})

const $miniBarFill =
  (backgroundColor: string): ThemedStyle<ViewStyle> =>
  ({ radius }) => ({
    width: "100%",
    borderRadius: radius.medium,
    backgroundColor,
  })

const $miniBarLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $actionsCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $quickActionsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $actionPill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $actionText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $twoColumnRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
})

const $halfCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.sm,
})

const $tightStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $rowCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $rowMarker: ThemedStyle<ViewStyle> = ({ radius }) => ({
  width: 8,
  height: 8,
  borderRadius: radius.pill,
})

const $rowCopy: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $rowTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $rowMeta: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $alertRow: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $alertLead: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  flex: 1,
})

const $alertDot: ThemedStyle<ViewStyle> = ({ radius }) => ({
  width: 8,
  height: 8,
  borderRadius: radius.pill,
})

const $agendaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.sm,
})

const $agendaLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  width: 62,
  color: colors.textDim,
})

const $agendaItems: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xs,
})

const $agendaItem: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  gap: 4,
})

const $agendaTitleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})
