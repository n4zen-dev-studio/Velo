import { useEffect, useMemo, useState } from "react"
import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AnimatedBackground } from "@/components/AnimatedBackground"
import { DashboardTaskStatusChart } from "@/components/charts/DashboardTaskStatusChart"
import { DashboardTimelineGraph } from "@/components/charts/DashboardTimelineGraph"
import { GlassCard } from "@/components/GlassCard"
import { HeaderAvatar } from "@/components/HeaderAvatar"
import { PriorityDot } from "@/components/PriorityDot"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { BASE_URL } from "@/config/api"
import { goToInvites, goToProfile, goToProjectsTab } from "@/navigation/navigationActions"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { createHttpClient } from "@/services/api/httpClient"
import { listMyInvites } from "@/services/api/invitesApi"
import { useAuthSession } from "@/services/auth/session"
import { listProjects } from "@/services/db/repositories/projectsRepository"
import type { Project, Task } from "@/services/db/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateRange, formatDateTime } from "@/utils/dateFormat"

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

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const CARD_WIDTH = SCREEN_WIDTH * 0.86
const CARD_GAP = 12

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
  const authSession = useAuthSession()
  const [activeChartIndex, setActiveChartIndex] = useState(0)

  const onChartsScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x
    const index = Math.round(x / (CARD_WIDTH + CARD_GAP))
    setActiveChartIndex(index)
  }

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
      { label: "To do", value: todoCount, tone: theme.colors.glowStrong },
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

  const completionTrend = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(now)
      day.setDate(now.getDate() - (6 - index))
      const key = day.toISOString().slice(0, 10)
      const value = allTasks.filter((task) => task.endDate?.slice(0, 10) === key).length
      return {
        key,
        label: day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
        value,
      }
    })
  }, [allTasks])

  const maxCompletionValue = Math.max(...completionTrend.map((item) => item.value), 1)
  const statusCategoryById = useMemo(
    () => Object.fromEntries(uiTasksByStatus.map((lane) => [lane.status.id, lane.status.category])),
    [uiTasksByStatus],
  )
  const timelineDays = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(now)
      day.setDate(now.getDate() - 1 + index)
      return {
        key: day.toISOString().slice(0, 10),
        label: day.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
      }
    })
  }, [])
  const dashboardTimelineItems = useMemo(() => {
    const firstDay = new Date(timelineDays[0].key)
    const lastDay = new Date(timelineDays[timelineDays.length - 1].key)
    return [...allTasks]
      .filter((task) => task.startDate || task.endDate)
      .sort((a, b) => {
        const aDate = a.startDate ?? a.endDate ?? a.updatedAt
        const bDate = b.startDate ?? b.endDate ?? b.updatedAt
        return new Date(aDate).getTime() - new Date(bDate).getTime()
      })
      .slice(0, 4)
      .map((task) => {
        const startSource = task.startDate ?? task.endDate ?? task.updatedAt
        const endSource = task.endDate ?? task.startDate ?? task.updatedAt
        const start = new Date(startSource)
        const end = new Date(endSource)
        const clampedStart = start < firstDay ? firstDay : start
        const clampedEnd = end > lastDay ? lastDay : end
        const startIndex = Math.max(
          0,
          Math.min(
            timelineDays.length - 1,
            Math.floor((clampedStart.getTime() - firstDay.getTime()) / 86400000),
          ),
        )
        const endIndex = Math.max(
          startIndex,
          Math.min(
            timelineDays.length - 1,
            Math.floor((clampedEnd.getTime() - firstDay.getTime()) / 86400000),
          ),
        )
        const category = statusCategoryById[task.statusId]
        const tone =
          category === "done"
            ? theme.colors.success
            : category === "in_progress"
              ? theme.colors.primary
              : theme.colors.warning

        return {
          id: task.id,
          title: task.title,
          subtitle: formatDateRange(task.startDate, task.endDate),
          tone,
          startIndex,
          span: Math.max(1, endIndex - startIndex + 1),
        }
      })
  }, [
    allTasks,
    statusCategoryById,
    theme.colors.primary,
    theme.colors.success,
    theme.colors.warning,
    timelineDays,
  ])

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
    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const tomorrowKey = tomorrow.toISOString().slice(0, 10)
    const weekEnd = new Date(now)
    weekEnd.setDate(now.getDate() + 7)

    const undonTasks = allTasks.filter((task) => !doneStatusIds.has(task.statusId))
    const datedTasks = [...undonTasks].sort((a, b) => {
      const aDate = a.startDate ?? a.endDate ?? a.updatedAt
      const bDate = b.startDate ?? b.endDate ?? b.updatedAt
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    })

    const today = datedTasks.filter(
      (task) => (task.startDate ?? task.endDate)?.slice(0, 10) === todayKey,
    )
    const tomorrowTasks = datedTasks.filter(
      (task) => (task.startDate ?? task.endDate)?.slice(0, 10) === tomorrowKey,
    )
    const thisWeek = datedTasks.filter((task) => {
      const source = task.startDate ?? task.endDate
      if (!source) return false
      const date = new Date(source)
      return date >= now && date <= weekEnd
    })

    return [
      { label: "Today", tasks: today },
      { label: "Tomorrow", tasks: tomorrowTasks },
      { label: "This week", tasks: thisWeek },
    ]
  }, [allTasks, doneStatusIds])

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
    <AnimatedBackground>
      <Screen
        preset="scroll"
        // safeAreaEdges={["top", "bottom"]}
        backgroundColor="transparent"
        contentContainerStyle={themed([$screen, { paddingTop: useSafeAreaInsets().top, paddingBottom: useSafeAreaInsets().bottom },])}
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
              <HeaderAvatar
                onPress={() => authSession.isAuthenticated && goToProfile()}
                size={40}
              />
              <View style={themed($headerTitleWrap)}>
                <Text preset="heading" text="Dashboard" style={themed($headerTitle)} />
                <Text
                  preset="overline"
                  text={activeWorkspace?.kind === "personal" ? "Personal project" : "Project view"}
                  style={themed($headerCaption)}
                />
              </View>
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
          <View style={themed($chartsCarouselWrap)}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={CARD_WIDTH + CARD_GAP}
              snapToAlignment="start"
              contentContainerStyle={themed($chartsCarouselContent)}
              onScroll={onChartsScroll}
              scrollEventThrottle={16}
            >
              <GlassCard style={[themed($chartCard), themed($chartCarouselCard)]}>
                <View style={themed($compactSectionHeader)}>
                  <Text preset="formLabel" text="Task status" />
                  <Text
                    preset="caption"
                    text={`${doneCount}/${Math.max(allTasks.length, 1)} complete`}
                    style={themed($mutedText)}
                  />
                </View>

                <DashboardTaskStatusChart
                  items={statusBreakdown}
                  total={allTasks.length}
                  completionLabel={`${Math.round((doneCount / Math.max(allTasks.length, 1)) * 100)}% completed`}
                />

                <View style={themed($trendRow)}>
                  <View>
                    <Text preset="caption" text="Completion trend" style={themed($mutedText)} />
                    <Text
                      preset="caption"
                      text={`${doneCount}/${Math.max(allTasks.length, 1)} tasks finished`}
                      style={themed($legendValue)}
                    />
                  </View>

                  <View style={themed($sparkRow)}>
                    {completionTrend.map((point) => (
                      <View key={point.key} style={themed($sparkColumn)}>
                        <View style={themed($sparkTrack)}>
                          <View
                            style={[
                              themed($sparkFill),
                              {
                                height: `${Math.max(
                                  (point.value / maxCompletionValue) * 100,
                                  point.value > 0 ? 20 : 0,
                                )}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text preset="caption" text={point.label} style={themed($miniBarLabel)} />
                      </View>
                    ))}
                  </View>
                </View>
              </GlassCard>

              <GlassCard style={[themed($chartCard), themed($chartCarouselCard)]}>
                <View style={themed($compactSectionHeader)}>
                  <Text preset="formLabel" text="Near timeline" />
                  <Text
                    preset="caption"
                    text={dashboardTimelineItems.length > 0 ? "Next 7 days" : "No dated tasks yet"}
                    style={themed($mutedText)}
                  />
                </View>

                <DashboardTimelineGraph
                  days={timelineDays}
                  items={dashboardTimelineItems}
                  emptyLabel="Add start or end dates to tasks to visualize active work across the week."
                />
              </GlassCard>
            </ScrollView>

            <View style={themed($carouselHintRow)}>
              <Text preset="caption" text="Swipe for more" style={themed($carouselHintText)} />
            </View>

            <View style={themed($carouselDots)}>
              {[0, 1].map((index) => (
                <View
                  key={index}
                  style={[
                    themed($carouselDot),
                    activeChartIndex === index && themed($carouselDotActive),
                  ]}
                />
              ))}
            </View>
          </View>
          {/* <GlassCard style={themed($chartCard)}>
          <View style={themed($compactSectionHeader)}>
            <Text preset="formLabel" text="Task status" />
            <Text
              preset="caption"
              text={`${doneCount}/${Math.max(allTasks.length, 1)} complete`}
              style={themed($mutedText)}
            />
          </View>
          <DashboardTaskStatusChart
            items={statusBreakdown}
            total={allTasks.length}
            completionLabel={`${Math.round((doneCount / Math.max(allTasks.length, 1)) * 100)}% completed`}
          />

          <View style={themed($trendRow)}>
            <View>
              <Text preset="caption" text="Completion trend" style={themed($mutedText)} />
              <Text
                preset="caption"
                text={`${doneCount}/${Math.max(allTasks.length, 1)} tasks finished`}
                style={themed($legendValue)}
              />
            </View>
            <View style={themed($sparkRow)}>
              {completionTrend.map((point) => (
                <View key={point.key} style={themed($sparkColumn)}>
                  <View style={themed($sparkTrack)}>
                    <View
                      style={[
                        themed($sparkFill),
                        {
                          height: `${Math.max((point.value / maxCompletionValue) * 100, point.value > 0 ? 20 : 0)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text preset="caption" text={point.label} style={themed($miniBarLabel)} />
                </View>
              ))}
            </View>
          </View>
        </GlassCard>

        <GlassCard style={themed($chartCard)}>
          <View style={themed($compactSectionHeader)}>
            <Text preset="formLabel" text="Near timeline" />
            <Text
              preset="caption"
              text={dashboardTimelineItems.length > 0 ? "Next 7 days" : "No dated tasks yet"}
              style={themed($mutedText)}
            />
          </View>
          <DashboardTimelineGraph
            days={timelineDays}
            items={dashboardTimelineItems}
            emptyLabel="Add start or end dates to tasks to visualize active work across the week."
          />
        </GlassCard> */}

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
              <CompactAction
                label="Create task"
                onPress={() => navigation.navigate("TaskEditor")}
              />
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
                <Text
                  preset="caption"
                  text={`${activityItems.length}`}
                  style={themed($mutedText)}
                />
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
    </AnimatedBackground>
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
  paddingBottom: spacing.lg,
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

const $headerTitleWrap: ThemedStyle<ViewStyle> = () => ({
  paddingTop: 10,
  gap: 2,
  flex: 1,
})

const $headerTitle: ThemedStyle<TextStyle> = () => ({
  lineHeight: 22,
  paddingBottom: 5,
})

const $headerCaption: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
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
  width: "22%",
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
  gap: spacing.xxs,
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

const $legendValue: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $miniBarLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $trendRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: spacing.md,
})

const $sparkRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-end",
  gap: spacing.xs,
})

const $sparkColumn: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  gap: spacing.xxxs,
})

const $sparkTrack: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: 10,
  height: 36,
  borderRadius: radius.pill,
  backgroundColor: colors.backgroundSecondary,
  justifyContent: "flex-end",
  overflow: "hidden",
})

const $sparkFill: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: "100%",
  borderRadius: radius.pill,
  backgroundColor: colors.primary,
})

const $actionsCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $quickActionsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xxs,
})

const $actionPill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  backgroundColor: colors.glowSoft,
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

const $chartsCarouselWrap: ThemedStyle<ViewStyle> = () => ({
  marginTop: 4,
})

const $chartsCarouselContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingRight: spacing.md,
})

const $chartCarouselCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: CARD_WIDTH,
  marginRight: CARD_GAP,
  flexShrink: 0,
})

const $carouselHintRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignItems: "center",
  marginTop: spacing.xs,
})

const $carouselHintText = ({ colors }: any): TextStyle => ({
  color: colors.textDim,
  opacity: 0.75,
})

const $carouselDots: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  gap: spacing.xs,
  marginTop: spacing.xs,
})

const $carouselDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 6,
  height: 6,
  borderRadius: 999,
  backgroundColor: colors.border,
  opacity: 0.5,
})

const $carouselDotActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 18,
  backgroundColor: colors.tint,
  opacity: 1,
})
