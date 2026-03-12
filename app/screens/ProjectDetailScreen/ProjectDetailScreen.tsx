import { useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { PriorityDot } from "@/components/PriorityDot"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { ProjectsStackScreenProps } from "@/navigators/navigationTypes"
import { createHttpClient } from "@/services/api/httpClient"
import {
  inviteToWorkspace,
  listWorkspaceInvites,
  type WorkspaceInvite,
} from "@/services/api/invitesApi"
import { listWorkspaceMembers as listWorkspaceMembersApi } from "@/services/api/workspacesApi"
import { BASE_URL } from "@/config/api"
import { listProjects } from "@/services/db/repositories/projectsRepository"
import { listStatuses } from "@/services/db/repositories/statusesRepository"
import { listTasksByWorkspace } from "@/services/db/repositories/tasksRepository"
import { listByWorkspaceId as listWorkspaceMembersLocal } from "@/services/db/repositories/workspaceMembersRepository"
import type { Project, Status, Task, WorkspaceMember } from "@/services/db/types"
import { useAuthSession } from "@/services/auth/session"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateTime } from "@/utils/dateFormat"
import { resolveUserLabel, resolveUserMeta } from "@/utils/userLabel"

type Segment = "overview" | "board" | "timeline" | "team"

type MemberSummary = {
  id: string
  label: string
  role: string
  assignments: number
}

export function ProjectDetailScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<ProjectsStackScreenProps<"ProjectDetail">["navigation"]>()
  const route = useRoute<ProjectsStackScreenProps<"ProjectDetail">["route"]>()
  const { workspaceId } = route.params
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useWorkspaceStore()
  const authSession = useAuthSession()

  const [segment, setSegment] = useState<Segment>("overview")
  const [statuses, setStatuses] = useState<Status[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [streams, setStreams] = useState<Project[]>([])
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null)

  const workspace = useMemo(
    () => workspaces.find((item) => item.id === workspaceId) ?? null,
    [workspaceId, workspaces],
  )

  const loadProjectData = useCallback(async () => {
    const [statusRows, taskRows, streamRows, localMembers] = await Promise.all([
      listStatuses(workspaceId, null),
      listTasksByWorkspace(workspaceId),
      listProjects(workspaceId),
      listWorkspaceMembersLocal(workspaceId),
    ])

    setStatuses(statusRows)
    setTasks(taskRows)
    setStreams(streamRows)

    const labels = await Promise.all(
      localMembers.map(async (member) => {
        const meta = await resolveUserMeta(member.userId)
        const assignments = taskRows.filter((task) => task.assigneeUserId === member.userId).length
        return {
          id: member.userId,
          label: meta.label,
          role: member.role,
          assignments,
        }
      }),
    )
    setMembers(labels)

    if (authSession.isAuthenticated) {
      try {
        const client = createHttpClient(BASE_URL)
        const [remoteMembers, remoteInvites] = await Promise.all([
          listWorkspaceMembersApi(client, workspaceId),
          listWorkspaceInvites(client, workspaceId),
        ])

        const nextMembers = await Promise.all(
          remoteMembers.map(async (member) => ({
            id: member.userId,
            label:
              member.user?.displayName ??
              member.user?.username ??
              member.user?.email ??
              (await resolveUserLabel(member.userId)),
            role: member.role,
            assignments: taskRows.filter((task) => task.assigneeUserId === member.userId).length,
          })),
        )
        setMembers(nextMembers)
        setInvites(remoteInvites)
      } catch {
        setInvites([])
      }
    }
  }, [authSession.isAuthenticated, workspaceId])

  useFocusEffect(
    useCallback(() => {
      void setActiveWorkspaceId(workspaceId)
      void loadProjectData()
    }, [loadProjectData, setActiveWorkspaceId, workspaceId]),
  )

  useEffect(() => {
    if (activeWorkspaceId !== workspaceId) {
      void setActiveWorkspaceId(workspaceId)
    }
  }, [activeWorkspaceId, setActiveWorkspaceId, workspaceId])

  const statusById = useMemo(
    () => Object.fromEntries(statuses.map((status) => [status.id, status])),
    [statuses],
  )
  const doneIds = useMemo(
    () =>
      new Set(statuses.filter((status) => status.category === "done").map((status) => status.id)),
    [statuses],
  )
  const lanes = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        tasks: tasks.filter((task) => task.statusId === status.id),
      })),
    [statuses, tasks],
  )
  const doneCount = tasks.filter((task) => doneIds.has(task.statusId)).length
  const progress = tasks.length === 0 ? 0 : doneCount / tasks.length
  const highPriorityTasks = tasks.filter(
    (task) => task.priority === "high" && !doneIds.has(task.statusId),
  )
  const boardTasks = [...tasks].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  const timelineDays = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(now)
      day.setDate(now.getDate() - (6 - index))
      const key = day.toISOString().slice(0, 10)
      const count = tasks.filter((task) => task.updatedAt.slice(0, 10) === key).length
      return { key, label: day.toLocaleDateString(undefined, { weekday: "short" }), count }
    })
  }, [tasks])
  const maxTimelineCount = Math.max(...timelineDays.map((day) => day.count), 1)

  const timelineAgenda = useMemo(() => {
    const groups: Array<{ label: string; items: Task[] }> = []
    const map = new Map<string, Task[]>()
    boardTasks.forEach((task) => {
      const key = task.updatedAt.slice(0, 10)
      const current = map.get(key) ?? []
      current.push(task)
      map.set(key, current)
    })
    Array.from(map.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .slice(0, 5)
      .forEach(([key, items]) => {
        groups.push({
          label: new Date(key).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
          items,
        })
      })
    return groups
  }, [boardTasks])

  const handleInvite = async () => {
    const trimmed = inviteEmail.trim().toLowerCase()
    if (!trimmed) {
      setInviteFeedback("Enter an email to invite.")
      return
    }
    try {
      const client = createHttpClient(BASE_URL)
      await inviteToWorkspace(client, workspaceId, trimmed, workspace?.label)
      setInviteEmail("")
      setInviteFeedback("Invite sent.")
      await loadProjectData()
    } catch (error) {
      setInviteFeedback(error instanceof Error ? error.message : "Invite failed.")
    }
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <View style={themed($headerCopy)}>
          <Text preset="overline" text="Project" />
          <Text preset="display" text={workspace?.label ?? "Project"} style={themed($title)} />
          <Text
            preset="formHelper"
            text={
              workspace?.kind === "personal"
                ? "Personal execution flow"
                : `${workspace?.membersCount ?? members.length} people aligned in one delivery space`
            }
            style={themed($subtitle)}
          />
        </View>
        <Button text="New task" onPress={() => navigation.navigate("TaskEditor")} />
      </View>

      <GlassCard>
        <View style={themed($heroHeader)}>
          <View>
            <Text preset="sectionTitle" text="Project overview" />
            <Text
              preset="formHelper"
              text={`${streams.length} tracks · ${tasks.length} total tasks`}
            />
          </View>
          <Button
            text="Dashboard"
            preset="glass"
            onPress={() => navigation.getParent()?.navigate("DashboardTab" as never)}
          />
        </View>

        <View style={themed($summaryGrid)}>
          <SummaryTile label="Open" value={`${tasks.length - doneCount}`} />
          <SummaryTile label="Done" value={`${doneCount}`} />
          <SummaryTile label="Team" value={`${members.length || workspace?.membersCount || 1}`} />
          <SummaryTile label="At risk" value={`${highPriorityTasks.length}`} />
        </View>

        <View style={themed($progressSection)}>
          <View style={themed($progressTrack)}>
            <View
              style={[
                themed($progressFill),
                { width: `${Math.max(progress * 100, progress > 0 ? 10 : 0)}%` },
              ]}
            />
          </View>
          <Text preset="caption" text={`${Math.round(progress * 100)}% complete`} />
        </View>
      </GlassCard>

      <View style={themed($segmentRow)}>
        {[
          { id: "overview", label: "Overview" },
          { id: "board", label: "Board" },
          { id: "timeline", label: "Timeline" },
          { id: "team", label: "Team" },
        ].map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSegment(item.id as Segment)}
            style={[themed($segmentChip), segment === item.id && themed($segmentChipActive)]}
          >
            <Text preset="caption" text={item.label} />
          </Pressable>
        ))}
      </View>

      {segment === "overview" ? (
        <>
          <GlassCard>
            <View style={themed($sectionHeader)}>
              <View>
                <Text preset="sectionTitle" text="Priority queue" />
                <Text preset="formHelper" text="Items to unblock or move first." />
              </View>
            </View>
            {highPriorityTasks.length === 0 ? (
              <Text preset="formHelper" text="No high-priority tasks are currently stalled." />
            ) : (
              <View style={themed($stack)}>
                {highPriorityTasks.slice(0, 4).map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    statusLabel={statusById[task.statusId]?.name ?? "Task"}
                    onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                  />
                ))}
              </View>
            )}
          </GlassCard>

          <GlassCard>
            <View style={themed($sectionHeader)}>
              <View>
                <Text preset="sectionTitle" text="Tracks" />
                <Text preset="formHelper" text="Nested streams inside this project." />
              </View>
            </View>
            {streams.length === 0 ? (
              <Text
                preset="formHelper"
                text="No additional tracks yet. Tasks are running on the primary board."
              />
            ) : (
              <View style={themed($stack)}>
                {streams.map((stream) => (
                  <View key={stream.id} style={themed($streamCard)}>
                    <Text preset="formLabel" text={stream.name} />
                    <Text preset="caption" text={`Updated ${formatDateTime(stream.updatedAt)}`} />
                  </View>
                ))}
              </View>
            )}
          </GlassCard>
        </>
      ) : null}

      {segment === "board" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={themed($boardScroll)}
        >
          {lanes.map((lane) => (
            <GlassCard key={lane.status.id} style={themed($laneCard)}>
              <View style={themed($laneHeader)}>
                <Text preset="sectionTitle" text={lane.status.name} />
                <Text preset="caption" text={`${lane.tasks.length}`} />
              </View>
              <View style={themed($stack)}>
                {lane.tasks.length === 0 ? (
                  <Text preset="formHelper" text="No tasks in this lane." />
                ) : (
                  lane.tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      statusLabel={statusById[task.statusId]?.name ?? lane.status.name}
                      onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                    />
                  ))
                )}
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      ) : null}

      {segment === "timeline" ? (
        <>
          <GlassCard>
            <View style={themed($sectionHeader)}>
              <View>
                <Text preset="sectionTitle" text="Weekly rhythm" />
                <Text
                  preset="formHelper"
                  text="Activity-based timeline until due dates are introduced."
                />
              </View>
            </View>
            <View style={themed($timelineBars)}>
              {timelineDays.map((day) => (
                <View key={day.key} style={themed($timelineDay)}>
                  <View style={themed($timelineBarTrack)}>
                    <View
                      style={[
                        themed($timelineBarFill),
                        {
                          height: `${Math.max((day.count / maxTimelineCount) * 100, day.count > 0 ? 12 : 0)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text preset="caption" text={day.label} />
                  <Text preset="caption" text={`${day.count}`} />
                </View>
              ))}
            </View>
          </GlassCard>

          <GlassCard>
            <View style={themed($sectionHeader)}>
              <View>
                <Text preset="sectionTitle" text="Activity agenda" />
                <Text
                  preset="formHelper"
                  text="Recent updates grouped into a planning-friendly stream."
                />
              </View>
            </View>
            <View style={themed($stack)}>
              {timelineAgenda.map((group) => (
                <View key={group.label} style={themed($agendaGroup)}>
                  <Text preset="overline" text={group.label} />
                  <View style={themed($stack)}>
                    {group.items.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        statusLabel={statusById[task.statusId]?.name ?? "Task"}
                        onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </GlassCard>
        </>
      ) : null}

      {segment === "team" ? (
        <>
          <GlassCard>
            <View style={themed($sectionHeader)}>
              <View>
                <Text preset="sectionTitle" text="Team overview" />
                <Text preset="formHelper" text="Assignment load and collaboration roles." />
              </View>
            </View>
            <View style={themed($stack)}>
              {members.length === 0 ? (
                <Text preset="formHelper" text="No team members synced for this project yet." />
              ) : (
                members.map((member) => (
                  <View key={member.id} style={themed($memberCard)}>
                    <View style={themed($memberHeader)}>
                      <View>
                        <Text preset="formLabel" text={member.label} />
                        <Text preset="caption" text={member.role} />
                      </View>
                      <Text preset="subheading" text={`${member.assignments}`} />
                    </View>
                    <Text preset="formHelper" text="Assigned tasks in this project" />
                  </View>
                ))
              )}
            </View>
          </GlassCard>

          {authSession.isAuthenticated ? (
            <GlassCard>
              <View style={themed($sectionHeader)}>
                <View>
                  <Text preset="sectionTitle" text="Invite collaborators" />
                  <Text
                    preset="formHelper"
                    text="Owner and admin roles can grow the team from here."
                  />
                </View>
              </View>
              <TextField
                value={inviteEmail}
                onChangeText={(value) => {
                  setInviteEmail(value)
                  if (inviteFeedback) setInviteFeedback(null)
                }}
                placeholder="teammate@company.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {inviteFeedback ? (
                <Text preset="formHelper" text={inviteFeedback} style={themed($feedback)} />
              ) : null}
              <View style={themed($stack)}>
                <Button text="Send invite" onPress={handleInvite} />
                {invites.map((invite) => (
                  <View key={invite.id} style={themed($inviteCard)}>
                    <Text preset="formLabel" text={invite.email} />
                    <Text preset="caption" text={`${invite.role} · ${invite.status}`} />
                  </View>
                ))}
              </View>
            </GlassCard>
          ) : null}
        </>
      ) : null}
    </Screen>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($summaryTile)}>
      <Text preset="caption" text={label} />
      <Text preset="heading" text={value} />
    </View>
  )
}

function TaskItem({
  task,
  statusLabel,
  onPress,
}: {
  task: Task
  statusLabel: string
  onPress: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable onPress={onPress} style={themed($taskCard)}>
      <View style={themed($taskTopRow)}>
        <View style={themed($taskTitleRow)}>
          <PriorityDot priority={task.priority} />
          <Text preset="formLabel" text={task.title} style={themed($taskTitle)} />
        </View>
        <Text preset="caption" text={statusLabel} />
      </View>
      {!!task.description ? (
        <Text
          preset="formHelper"
          text={task.description}
          numberOfLines={2}
          style={themed($taskDescription)}
        />
      ) : null}
      <Text preset="caption" text={`Updated ${formatDateTime(task.updatedAt)}`} />
    </Pressable>
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

const $heroHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.md,
  alignItems: "flex-start",
  marginBottom: spacing.md,
})

const $summaryGrid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $summaryTile: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  width: "47%",
  minWidth: 140,
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.md,
  gap: spacing.xxxs,
})

const $progressSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.lg,
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

const $segmentRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.sm,
})

const $segmentChip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $segmentChipActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
  gap: spacing.xxs,
})

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $streamCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.md,
  gap: spacing.xxxs,
})

const $boardScroll: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  paddingRight: spacing.screenHorizontal,
})

const $laneCard: ThemedStyle<ViewStyle> = () => ({
  width: 280,
})

const $laneHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.sm,
  marginBottom: spacing.md,
})

const $timelineBars: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: spacing.sm,
})

const $timelineDay: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  alignItems: "center",
  gap: spacing.xs,
})

const $timelineBarTrack: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: "100%",
  height: 96,
  borderRadius: radius.medium,
  backgroundColor: colors.backgroundSecondary,
  justifyContent: "flex-end",
  overflow: "hidden",
})

const $timelineBarFill: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: "100%",
  borderRadius: radius.medium,
  backgroundColor: colors.primaryAlt,
})

const $agendaGroup: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $memberCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.md,
  gap: spacing.xxs,
})

const $memberHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.sm,
  alignItems: "center",
})

const $feedback: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.primary,
})

const $inviteCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.md,
  gap: spacing.xxxs,
})

const $taskCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  padding: spacing.md,
  gap: spacing.xs,
})

const $taskTopRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.sm,
  alignItems: "center",
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
