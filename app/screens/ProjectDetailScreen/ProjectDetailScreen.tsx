import { useCallback, useMemo, useRef, useState } from "react"
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native"
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AnimatedBackground } from "@/components/AnimatedBackground"
import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { PriorityDot } from "@/components/PriorityDot"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { BASE_URL } from "@/config/api"
import type { ProjectsStackScreenProps } from "@/navigators/navigationTypes"
import { createHttpClient } from "@/services/api/httpClient"
import { listWorkspaceMembers as listWorkspaceMembersApi } from "@/services/api/workspacesApi"
import { useAuthSession } from "@/services/auth/session"
import { listProjects } from "@/services/db/repositories/projectsRepository"
import { listStatuses } from "@/services/db/repositories/statusesRepository"
import { listTasksByWorkspace } from "@/services/db/repositories/tasksRepository"
import { listByWorkspaceId as listWorkspaceMembersLocal } from "@/services/db/repositories/workspaceMembersRepository"
import { updateTaskStatusOnly } from "@/services/db/taskMutations"
import type { Project, Status, Task } from "@/services/db/types"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateRange, formatDateTime, formatShortDate } from "@/utils/dateFormat"
import { resolveUserLabel, resolveUserMeta } from "@/utils/userLabel"

type Segment = "board" | "timeline" | "team" | "overview"

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
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { workspaceId } = route.params
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId } = useWorkspaceStore()
  const authSession = useAuthSession()

  const [segment, setSegment] = useState<Segment>("board")
  const [statuses, setStatuses] = useState<Status[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [streams, setStreams] = useState<Project[]>([])
  const [members, setMembers] = useState<MemberSummary[]>([])
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState(false)
  const boardScrollRef = useRef<ScrollView>(null)
  const [activeLaneIndex, setActiveLaneIndex] = useState(0)
  const [laneOffsets, setLaneOffsets] = useState<number[]>([])

  const onBoardScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x

    if (!laneOffsets.length) return

    let closestIndex = 0
    let closestDistance = Math.abs(laneOffsets[0] - x)

    for (let i = 1; i < laneOffsets.length; i++) {
      const distance = Math.abs(laneOffsets[i] - x)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = i
      }
    }

    if (closestIndex !== activeLaneIndex) {
      setActiveLaneIndex(closestIndex)
    }
  }

  const scrollToLane = (index: number) => {
    const x = laneOffsets[index] ?? 0
    boardScrollRef.current?.scrollTo({ x, animated: true })
    setActiveLaneIndex(index)
  }
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
        const remoteMembers = await listWorkspaceMembersApi(client, workspaceId)

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
      } catch {}
    }
  }, [authSession.isAuthenticated, workspaceId])

  useFocusEffect(
    useCallback(() => {
      if (activeWorkspaceId !== workspaceId) {
        void setActiveWorkspaceId(workspaceId)
      }
      void loadProjectData()
    }, [activeWorkspaceId, loadProjectData, setActiveWorkspaceId, workspaceId]),
  )

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
      statuses.map((status, index) => ({
        status,
        index,
        tasks: tasks.filter((task) => task.statusId === status.id),
      })),
    [statuses, tasks],
  )

  const doneCount = tasks.filter((task) => doneIds.has(task.statusId)).length
  const openCount = Math.max(tasks.length - doneCount, 0)
  const highPriorityTasks = tasks.filter(
    (task) => task.priority === "high" && !doneIds.has(task.statusId),
  )
  const progress = tasks.length === 0 ? 0 : doneCount / tasks.length
  const boardTasks = [...tasks].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  const timelineDays = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(now)
      day.setDate(now.getDate() - 2 + index)
      const key = day.toISOString().slice(0, 10)
      const count = tasks.filter(
        (task) => (task.startDate ?? task.endDate)?.slice(0, 10) === key,
      ).length
      return { key, label: day.toLocaleDateString(undefined, { weekday: "short" }), count }
    })
  }, [tasks])
  const maxTimelineCount = Math.max(...timelineDays.map((day) => day.count), 1)

  const timelineAgenda = useMemo(() => {
    const groups: Array<{ label: string; items: Task[] }> = []
    const map = new Map<string, Task[]>()
    boardTasks
      .filter((task) => task.startDate || task.endDate)
      .forEach((task) => {
        const key = (task.startDate ?? task.endDate)!.slice(0, 10)
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

  const timelineUndated = useMemo(
    () => boardTasks.filter((task) => !task.startDate && !task.endDate).slice(0, 4),
    [boardTasks],
  )

  const moveTask = useCallback(
    async (task: Task, direction: "back" | "forward") => {
      const laneIndex = lanes.findIndex((lane) => lane.status.id === task.statusId)
      if (laneIndex < 0) return
      const nextIndex = direction === "forward" ? laneIndex + 1 : laneIndex - 1
      if (nextIndex < 0 || nextIndex >= lanes.length) return
      const nextStatusId = lanes[nextIndex].status.id

      const previousTasks = tasks
      setMovingTaskId(task.id)
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                statusId: nextStatusId,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      )

      try {
        await updateTaskStatusOnly(task.id, nextStatusId)
        await loadProjectData()
      } catch {
        setTasks(previousTasks)
      } finally {
        setMovingTaskId(null)
      }
    },
    [lanes, loadProjectData, tasks],
  )

  const fabBottom = Math.max(insets.bottom, 14) + 78
  const boardHeight = Math.max(height * 0.5 - fabBottom, 320)

  const handleWorkspaceSwitch = useCallback(
    async (nextWorkspaceId: string) => {
      if (nextWorkspaceId === workspaceId) {
        setIsWorkspacePickerOpen(false)
        return
      }
      await setActiveWorkspaceId(nextWorkspaceId)
      setIsWorkspacePickerOpen(false)
      navigation.replace("ProjectDetail", { workspaceId: nextWorkspaceId })
    },
    [navigation, setActiveWorkspaceId, workspaceId],
  )

  return (
    <AnimatedBackground>
      <Screen
        preset="fixed"
        backgroundColor="transparent"
        contentContainerStyle={themed([
          $screen,
          { paddingTop: useSafeAreaInsets().top, paddingBottom: useSafeAreaInsets().bottom },
        ])}
      >
        <View style={themed($header)}>
          <View style={themed($headerCopy)}>
            <Text preset="overline" text="Project" />
            <Text preset="heading" text={workspace?.label ?? "Project"} />
            <Text
              preset="caption"
              text={
                workspace?.kind === "personal"
                  ? "Personal execution flow"
                  : `${workspace?.membersCount ?? members.length} collaborators active`
              }
              style={themed($subtitle)}
            />
          </View>
          <Button
            text="Projects"
            preset="glassSmall"
            onPress={() => navigation.navigate("ProjectsHome")}
          />
        </View>

        <Pressable
          onPress={() => workspaces.length > 1 && setIsWorkspacePickerOpen(true)}
          style={[
            themed($workspaceSelector),
            workspaces.length <= 1 && themed($workspaceSelectorDisabled),
          ]}
        >
          <View style={themed($workspaceSelectorCopy)}>
            <Text preset="caption" text="Workspace" style={themed($subtitle)} />
            <Text preset="formLabel" text={workspace?.label ?? "Personal"} numberOfLines={1} />
          </View>
          <Text
            preset="caption"
            text={workspaces.length > 1 ? "Switch" : "Current"}
            style={themed($workspaceSelectorAction)}
          />
        </Pressable>

        <View style={themed($statPillsRow)}>
          <ProjectStatPill label="Open" value={`${openCount}`} tone="#dfd91e" />
          <ProjectStatPill label="Done" value={`${doneCount}`} tone="#57b396" />
          <ProjectStatPill
            label="Team"
            value={`${members.length || workspace?.membersCount || 1}`}
            tone="#4443ad"
          />
          <ProjectStatPill label="At risk" value={`${highPriorityTasks.length}`} tone="#cb5d1d" />
          <ProjectStatPill
            label="Complete"
            value={`${Math.round(progress * 100)}%`}
            tone="#14f326"
          />
        </View>

        <View style={themed($segmentRow)}>
          {[
            { id: "board", label: "Board" },
            { id: "timeline", label: "Timeline" },
            { id: "team", label: "Team" },
            { id: "overview", label: "Overview" },
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

        {segment === "board" ? (
          <View style={[themed($boardRegion), { minHeight: boardHeight }]}>
            <View style={themed($laneJumpSection)}>
              {/* <View style={themed($laneJumpHintRow)}>
              <Text
                preset="caption"
                text="Tap a lane below to jump there, or swipe across the board"
                style={themed($laneJumpHint)}
              />
            </View> */}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={themed($laneJumpScroll)}
              >
                {lanes.map((lane, laneIndex) => {
                  const isActive = laneIndex === activeLaneIndex

                  return (
                    <Pressable
                      key={lane.status.id}
                      onPress={() => scrollToLane(laneIndex)}
                      style={({ pressed }) => [
                        themed($laneJumpChip),
                        isActive && themed($laneJumpChipActive),
                        pressed && themed($laneJumpChipPressed),
                      ]}
                    >
                      <View style={themed($laneJumpChipContent)}>
                        <Text
                          preset="caption"
                          text={lane.status.name}
                          style={[themed($laneJumpTitle), isActive && themed($laneJumpTitleActive)]}
                        />
                        <Text
                          preset="caption"
                          text={`${lane.tasks.length} tasks`}
                          style={[themed($laneJumpCount), isActive && themed($laneJumpCountActive)]}
                        />
                      </View>
                    </Pressable>
                  )
                })}
              </ScrollView>

              <View style={themed($laneDots)}>
                {lanes.map((lane, laneIndex) => (
                  <View
                    key={lane.status.id}
                    style={[
                      themed($laneDot),
                      laneIndex === activeLaneIndex && themed($laneDotActive),
                    ]}
                  />
                ))}
              </View>
            </View>
            <ScrollView
              ref={boardScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={themed($boardScroll)}
              onScroll={onBoardScroll}
              scrollEventThrottle={16}
            >
              {lanes.map((lane, laneIndex) => (
                <View
                  key={lane.status.id}
                  onLayout={(event) => {
                    const x = event.nativeEvent.layout.x
                    setLaneOffsets((prev) => {
                      const next = [...prev]
                      next[laneIndex] = x
                      return next
                    })
                  }}
                >
                  <GlassCard style={[themed($laneCard), { height: boardHeight }]}>
                    <View style={themed($laneHeader)}>
                      <View>
                        <Text preset="formLabel" text={lane.status.name} />
                        <Text
                          preset="caption"
                          text={`${lane.tasks.length} tasks`}
                          style={themed($subtitle)}
                        />
                      </View>
                      <Text
                        preset="caption"
                        text={`${laneIndex + 1}/${lanes.length}`}
                        style={themed($subtitle)}
                      />
                    </View>

                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      style={themed($laneTasksScroll)}
                      contentContainerStyle={themed($stack)}
                    >
                      {lane.tasks.length === 0 ? (
                        <Text
                          preset="caption"
                          text="No tasks in this lane."
                          style={themed($subtitle)}
                        />
                      ) : (
                        lane.tasks.map((task) => (
                          <BoardTaskCard
                            key={task.id}
                            task={task}
                            statusLabel={lane.status.name}
                            assigneeLabel={
                              task.assigneeUserId
                                ? (members.find((member) => member.id === task.assigneeUserId)
                                    ?.label ?? "Assigned")
                                : "Unassigned"
                            }
                            disableBack={laneIndex === 0 || movingTaskId === task.id}
                            disableForward={
                              laneIndex === lanes.length - 1 || movingTaskId === task.id
                            }
                            onBack={() => void moveTask(task, "back")}
                            onForward={() => void moveTask(task, "forward")}
                            onOpen={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                          />
                        ))
                      )}
                      <View style={{ height: fabBottom }} />
                    </ScrollView>
                  </GlassCard>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* {segment === "board" ? (
        <View style={[themed($boardRegion), { minHeight: boardHeight }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={themed($boardScroll)}
          >
            {lanes.map((lane, laneIndex) => (
              <GlassCard key={lane.status.id} style={[themed($laneCard), { height: boardHeight }]}>
                <View style={themed($laneHeader)}>
                  <View>
                    <Text preset="formLabel" text={lane.status.name} />
                    <Text
                      preset="caption"
                      text={`${lane.tasks.length} tasks`}
                      style={themed($subtitle)}
                    />
                  </View>
                  <Text
                    preset="caption"
                    text={`${laneIndex + 1}/${lanes.length}`}
                    style={themed($subtitle)}
                  />
                </View>

                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={themed($laneTasksScroll)}
                  contentContainerStyle={themed($stack)}
                >
                  {lane.tasks.length === 0 ? (
                    <Text
                      preset="caption"
                      text="No tasks in this lane."
                      style={themed($subtitle)}
                    />
                  ) : (
                    lane.tasks.map((task) => (
                      <BoardTaskCard
                        key={task.id}
                        task={task}
                        statusLabel={lane.status.name}
                        assigneeLabel={
                          task.assigneeUserId
                            ? (members.find((member) => member.id === task.assigneeUserId)?.label ??
                              "Assigned")
                            : "Unassigned"
                        }
                        disableBack={laneIndex === 0 || movingTaskId === task.id}
                        disableForward={laneIndex === lanes.length - 1 || movingTaskId === task.id}
                        onBack={() => void moveTask(task, "back")}
                        onForward={() => void moveTask(task, "forward")}
                        onOpen={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                      />
                    ))
                  )}
                  <View style={{ height: fabBottom }} />
                </ScrollView>
              </GlassCard>
            ))}
          </ScrollView>
        </View>
      ) : null} */}

        {segment !== "board" ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={themed($secondaryContent)}
          >
            {segment === "timeline" ? (
              <>
                <GlassCard>
                  <View style={themed($sectionHeader)}>
                    <View>
                      <Text preset="formLabel" text="Weekly rhythm" />
                      <Text
                        preset="caption"
                        text="Tasks placed by start and completion dates."
                        style={themed($subtitle)}
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
                        <Text preset="caption" text={`${day.count}`} style={themed($subtitle)} />
                      </View>
                    ))}
                  </View>
                </GlassCard>

                <GlassCard>
                  <View style={themed($sectionHeader)}>
                    <View>
                      <Text preset="formLabel" text="Activity agenda" />
                      <Text
                        preset="caption"
                        text="Upcoming and completed work grouped by task dates."
                        style={themed($subtitle)}
                      />
                    </View>
                  </View>
                  <View style={themed($stack)}>
                    {timelineAgenda.map((group) => (
                      <View key={group.label} style={themed($agendaGroup)}>
                        <Text preset="overline" text={group.label} />
                        <View style={themed($stack)}>
                          {group.items.map((task) => (
                            <CompactTaskItem
                              key={task.id}
                              task={task}
                              statusLabel={statusById[task.statusId]?.name ?? "Task"}
                              timelineLabel={formatDateRange(task.startDate, task.endDate)}
                              onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                    {timelineUndated.length > 0 ? (
                      <View style={themed($agendaGroup)}>
                        <Text preset="overline" text="No date yet" />
                        <View style={themed($stack)}>
                          {timelineUndated.map((task) => (
                            <CompactTaskItem
                              key={task.id}
                              task={task}
                              statusLabel={statusById[task.statusId]?.name ?? "Task"}
                              timelineLabel="No start or end date"
                              onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                            />
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </GlassCard>
              </>
            ) : null}

            {segment === "team" ? (
              <>
                <GlassCard>
                  <View style={themed($sectionHeader)}>
                    <View>
                      <Text preset="formLabel" text="Team overview" />
                      <Text
                        preset="caption"
                        text="Assignment load and collaboration roles."
                        style={themed($subtitle)}
                      />
                    </View>
                  </View>
                  <View style={themed($stack)}>
                    {members.length === 0 ? (
                      <Text
                        preset="caption"
                        text="No team members synced for this project yet."
                        style={themed($subtitle)}
                      />
                    ) : (
                      members.map((member) => (
                        <View key={member.id} style={themed($memberCard)}>
                          <View style={themed($memberHeader)}>
                            <View>
                              <Text
                                preset="caption"
                                text={member.label}
                                style={themed($memberName)}
                              />
                              <Text preset="caption" text={member.role} style={themed($subtitle)} />
                            </View>
                            <Text
                              preset="caption"
                              text={`${member.assignments} assigned`}
                              style={themed($memberLoad)}
                            />
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </GlassCard>
              </>
            ) : null}

            {segment === "overview" ? (
              <>
                <GlassCard>
                  <View style={themed($sectionHeader)}>
                    <View>
                      <Text preset="formLabel" text="Priority queue" />
                      <Text
                        preset="caption"
                        text="Items to unblock or move first."
                        style={themed($subtitle)}
                      />
                    </View>
                  </View>
                  {highPriorityTasks.length === 0 ? (
                    <Text
                      preset="caption"
                      text="No high-priority tasks are currently stalled."
                      style={themed($subtitle)}
                    />
                  ) : (
                    <View style={themed($stack)}>
                      {highPriorityTasks.slice(0, 4).map((task) => (
                        <CompactTaskItem
                          key={task.id}
                          task={task}
                          statusLabel={statusById[task.statusId]?.name ?? "Task"}
                          timelineLabel={formatDateRange(task.startDate, task.endDate)}
                          onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                        />
                      ))}
                    </View>
                  )}
                </GlassCard>

                <GlassCard>
                  <View style={themed($sectionHeader)}>
                    <View>
                      <Text preset="formLabel" text="Tracks" />
                      <Text
                        preset="caption"
                        text="Nested streams inside this project."
                        style={themed($subtitle)}
                      />
                    </View>
                  </View>
                  {streams.length === 0 ? (
                    <Text
                      preset="caption"
                      text="No additional tracks yet. Tasks are running on the primary board."
                      style={themed($subtitle)}
                    />
                  ) : (
                    <View style={themed($stack)}>
                      {streams.map((stream) => (
                        <View key={stream.id} style={themed($streamCard)}>
                          <Text preset="caption" text={stream.name} style={themed($memberName)} />
                          <Text
                            preset="caption"
                            text={`Updated ${formatDateTime(stream.updatedAt)}`}
                            style={themed($subtitle)}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </GlassCard>
              </>
            ) : null}

            <View style={{ height: fabBottom }} />
          </ScrollView>
        ) : null}

        <ProjectFab bottom={fabBottom} onPress={() => navigation.navigate("TaskEditor")} />

        <Modal visible={isWorkspacePickerOpen} transparent animationType="fade">
          <Pressable style={themed($sheetBackdrop)} onPress={() => setIsWorkspacePickerOpen(false)}>
            <Pressable style={themed($workspaceSheet)} onPress={() => undefined}>
              <View style={themed($workspaceSheetHeader)}>
                <View style={themed($workspaceSheetHeaderCopy)}>
                  <Text preset="subheading" text="Switch workspace" />
                  <Text
                    preset="caption"
                    text="Jump between workspaces without leaving the current work surface."
                    style={themed($subtitle)}
                  />
                </View>
                <Button
                  text="Manage"
                  preset="glassSmall"
                  onPress={() => {
                    setIsWorkspacePickerOpen(false)
                    navigation.navigate("ProjectsHome")
                  }}
                />
              </View>

              <View style={themed($workspaceSheetList)}>
                {workspaces.map((item) => {
                  const isCurrent = item.id === workspaceId
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => void handleWorkspaceSwitch(item.id)}
                      style={[
                        themed($workspaceSheetItem),
                        isCurrent && themed($workspaceSheetItemActive),
                      ]}
                    >
                      <View style={themed($workspaceSheetCopy)}>
                        <Text preset="formLabel" text={item.label} />
                        <Text
                          preset="caption"
                          text={
                            item.kind === "personal" ? "Personal workspace" : "Shared workspace"
                          }
                          style={themed($subtitle)}
                        />
                      </View>
                      <Text
                        preset="caption"
                        text={isCurrent ? "Current" : "Select"}
                        style={
                          isCurrent
                            ? themed($workspaceSheetBadge)
                            : themed($workspaceSelectorAction)
                        }
                      />
                    </Pressable>
                  )
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </Screen>
    </AnimatedBackground>
  )
}

function ProjectStatPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($statPill)}>
      <View style={themed($statTopRow)}>
        <View style={[themed($statDot), { backgroundColor: tone }]} />
        <Text preset="caption" text={label} style={themed($subtitle)} />
      </View>
      <Text preset="caption" text={value} style={themed($memberName)} />
    </View>
  )
}

function BoardTaskCard({
  task,
  statusLabel,
  assigneeLabel,
  disableBack,
  disableForward,
  onBack,
  onForward,
  onOpen,
}: {
  task: Task
  statusLabel: string
  assigneeLabel: string
  disableBack: boolean
  disableForward: boolean
  onBack: () => void
  onForward: () => void
  onOpen: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable onPress={onOpen} style={themed($boardTaskCard)}>
      <View style={themed($boardTaskTop)}>
        <View style={themed($boardTaskTitleRow)}>
          <PriorityDot priority={task.priority} />
          <Text
            preset="caption"
            text={task.title}
            numberOfLines={2}
            style={themed($boardTaskTitle)}
          />
        </View>
        <Text preset="caption" text={statusLabel} style={themed($subtitle)} />
      </View>
      {!!task.description ? (
        <Text
          preset="caption"
          text={task.description}
          numberOfLines={2}
          style={themed($subtitle)}
        />
      ) : null}
      <View style={themed($boardTaskMeta)}>
        <Text preset="caption" text={assigneeLabel} numberOfLines={1} style={themed($subtitle)} />
        <Text
          preset="caption"
          text={
            task.startDate || task.endDate
              ? formatDateRange(task.startDate, task.endDate)
              : formatDateTime(task.updatedAt)
          }
          numberOfLines={1}
          style={themed($subtitle)}
        />
      </View>
      <TaskMoveControls
        disableBack={disableBack}
        disableForward={disableForward}
        onBack={onBack}
        onForward={onForward}
      />
    </Pressable>
  )
}

function TaskMoveControls({
  disableBack,
  disableForward,
  onBack,
  onForward,
}: {
  disableBack: boolean
  disableForward: boolean
  onBack: () => void
  onForward: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($moveRow)}>
      <Pressable
        onPress={onBack}
        disabled={disableBack}
        style={[themed($moveButton), disableBack && themed($moveButtonDisabled)]}
      >
        <Text preset="caption" text="Move Back" style={themed($moveButtonText)} />
      </Pressable>
      <Pressable
        onPress={onForward}
        disabled={disableForward}
        style={[themed($moveButtonPrimary), disableForward && themed($moveButtonDisabled)]}
      >
        <Text preset="caption" text="Move Forward" style={themed($moveButtonTextPrimary)} />
      </Pressable>
    </View>
  )
}

function CompactTaskItem({
  task,
  statusLabel,
  timelineLabel,
  onPress,
}: {
  task: Task
  statusLabel: string
  timelineLabel?: string
  onPress: () => void
}) {
  const { themed } = useAppTheme()
  return (
    <Pressable onPress={onPress} style={themed($compactTaskCard)}>
      <View style={themed($boardTaskTitleRow)}>
        <PriorityDot priority={task.priority} />
        <Text preset="caption" text={task.title} numberOfLines={1} style={themed($memberName)} />
      </View>
      <Text
        preset="caption"
        text={`${statusLabel} · ${timelineLabel ?? formatShortDate(task.updatedAt)}`}
        style={themed($subtitle)}
      />
    </Pressable>
  )
}

function ProjectFab({ bottom, onPress }: { bottom: number; onPress: () => void }) {
  const { themed } = useAppTheme()
  return (
    <Pressable onPress={onPress} style={[themed($fab), { bottom }]}>
      <Text preset="heading" text="+" style={themed($fabText)} />
    </Pressable>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.md,
  gap: spacing.md,
  paddingBottom: spacing.xxxl + 55,
  backgroundColor: "transparent",
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

const $workspaceSelector: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.md,
  borderRadius: radius.large,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
})

const $workspaceSelectorDisabled: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.72,
})

const $workspaceSelectorCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $workspaceSelectorAction: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.primary,
})

const $statPillsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xxxs,
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

const $statPill: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: 20,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  // flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $segmentRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $segmentChip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
})

const $segmentChipActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $boardRegion: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $boardScroll: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  paddingRight: spacing.screenHorizontal,
  paddingBottom: spacing.sm,
})

const $laneCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: 270,
  gap: spacing.xs,
})

const $laneHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
  marginBottom: spacing.sm,
})

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $laneTasksScroll: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $boardTaskCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.xs,
})

const $boardTaskTop: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $boardTaskTitleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
})

const $boardTaskTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  flex: 1,
  color: colors.text,
})

const $boardTaskMeta: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.xs,
})

const $moveRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $moveButton: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingVertical: spacing.xs,
  alignItems: "center",
})

const $moveButtonPrimary: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flex: 1,
  borderRadius: radius.pill,
  borderWidth: 1,
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
  paddingVertical: spacing.xs,
  alignItems: "center",
})

const $moveButtonDisabled: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.45,
})

const $moveButtonText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $moveButtonTextPrimary: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.sm,
})

const $secondaryContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingBottom: spacing.md,
  gap: spacing.md,
})

const $sheetBackdrop: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flex: 1,
  justifyContent: "flex-end",
  backgroundColor: colors.overlay,
  padding: spacing.md,
})

const $workspaceSheet: ThemedStyle<ViewStyle> = ({ colors, spacing, radius, elevation }) => ({
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceElevated,
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.lg,
  paddingBottom: spacing.lg,
  gap: spacing.md,
  ...elevation.card,
})

const $workspaceSheetHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.md,
})

const $workspaceSheetHeaderCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $workspaceSheetList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $workspaceSheetItem: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.md,
  borderRadius: radius.large,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
})

const $workspaceSheetItemActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $workspaceSheetCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $workspaceSheetBadge: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textInverse,
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
  height: 84,
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
  gap: spacing.xs,
})

const $memberCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
})

const $memberHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
})

const $memberName: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $memberLoad: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.primary,
})

const $compactTaskCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.xxxs,
})

const $streamCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.xxxs,
})

const $fab: ThemedStyle<ViewStyle> = ({ colors, elevation }) => ({
  position: "absolute",
  bottom: 20,
  right: 20,
  width: 58,
  height: 58,
  borderRadius: 29,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.primary,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.18)",
  ...elevation.glow,
})

const $fabText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textInverse,
})

const $laneJumpSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  // marginTop: spacing.sm,
  // gap: spacing.xs,
})

const $laneJumpHintRow: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  justifyContent: "center",
})

const $laneJumpHint: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  opacity: 0.8,
  textAlign: "center",
})

const $laneJumpScroll: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xs,
  paddingBottom: spacing.xs,
  paddingRight: spacing.md,
  gap: spacing.sm,
})

const $laneJumpChip: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  // minWidth: 104,
  paddingHorizontal: spacing.xs,
  paddingVertical: spacing.sm,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.card,
  opacity: 0.92,
})

const $laneJumpChipActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.tint,
  backgroundColor: colors.palette?.primary500 + "18" || colors.tint + "18",
})

const $laneJumpChipPressed: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.75,
})

const $laneJumpChipContent: ThemedStyle<ViewStyle> = () => ({
  alignItems: "center",
  justifyContent: "center",
})

const $laneJumpTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  textAlign: "center",
})

const $laneJumpTitleActive: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
})

const $laneJumpCount: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  marginTop: 2,
  textAlign: "center",
})

const $laneJumpCountActive: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  opacity: 0.9,
})

const $laneDots: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  gap: spacing.xs,
  marginVertical: spacing.xs,
})

const $laneDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 6,
  height: 6,
  borderRadius: 999,
  backgroundColor: colors.border,
  opacity: 0.45,
})

const $laneDotActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 18,
  backgroundColor: colors.tint,
  opacity: 1,
})
