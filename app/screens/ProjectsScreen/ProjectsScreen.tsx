import { useCallback, useMemo, useState } from "react"
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  TextStyle,
  TouchableOpacity,
  UIManager,
  View,
  ViewStyle,
} from "react-native"
import { useFocusEffect, useNavigation } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { BASE_URL } from "@/config/api"
import { goToInvites } from "@/navigation/navigationActions"
import type { ProjectsStackScreenProps } from "@/navigators/navigationTypes"
import { createHttpClient } from "@/services/api/httpClient"
import {
  deleteWorkspace as deleteWorkspaceApi,
  inviteToWorkspace,
  listWorkspaceInvites,
  removeWorkspaceMember,
  revokeWorkspaceInvite,
  type WorkspaceInvite,
} from "@/services/api/invitesApi"
import { listWorkspaceMembers as listWorkspaceMembersApi } from "@/services/api/workspacesApi"
import { useAuthSession } from "@/services/auth/session"
import { listProjects } from "@/services/db/repositories/projectsRepository"
import { listStatuses } from "@/services/db/repositories/statusesRepository"
import { listTasksByWorkspace } from "@/services/db/repositories/tasksRepository"
import { listByWorkspaceId as listWorkspaceMembersLocal } from "@/services/db/repositories/workspaceMembersRepository"
import type { Workspace } from "@/services/db/types"
import { syncController } from "@/services/sync/SyncController"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { formatDateTime } from "@/utils/dateFormat"
import { resolveUserLabel, resolveUserMeta } from "@/utils/userLabel"
import { Ionicons } from "@expo/vector-icons"

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type ProjectCard = {
  workspace: Workspace
  openTasks: number
  doneTasks: number
  inProgressTasks: number
  streamsCount: number
  updatedAt: string | null
}

type MemberSummary = {
  id: string
  label: string
  role: string
  assignments: number
}

export function ProjectsScreen() {
  const { themed, theme } = useAppTheme()
  const navigation = useNavigation<ProjectsStackScreenProps<"ProjectsHome">["navigation"]>()
  const authSession = useAuthSession()
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
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createLabel, setCreateLabel] = useState("")
  const [renameTarget, setRenameTarget] = useState<Workspace | null>(null)
  const [renameLabel, setRenameLabel] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [membersByWorkspaceId, setMembersByWorkspaceId] = useState<Record<string, MemberSummary[]>>(
    {},
  )
  const [invitesByWorkspaceId, setInvitesByWorkspaceId] = useState<
    Record<string, WorkspaceInvite[]>
  >({})
  const [inviteEmailByWorkspaceId, setInviteEmailByWorkspaceId] = useState<Record<string, string>>(
    {},
  )
  const [feedbackByWorkspaceId, setFeedbackByWorkspaceId] = useState<Record<string, string | null>>(
    {},
  )

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

  const loadManagementData = useCallback(
    async (workspace: Workspace) => {
      const [tasks, localMembers] = await Promise.all([
        listTasksByWorkspace(workspace.id),
        listWorkspaceMembersLocal(workspace.id),
      ])

      const localSummaries = await Promise.all(
        localMembers.map(async (member) => {
          const meta = await resolveUserMeta(member.userId)
          return {
            id: member.userId,
            label: meta.label,
            role: member.role,
            assignments: tasks.filter((task) => task.assigneeUserId === member.userId).length,
          }
        }),
      )
      setMembersByWorkspaceId((prev) => ({ ...prev, [workspace.id]: localSummaries }))

      if (!authSession.isAuthenticated) {
        setInvitesByWorkspaceId((prev) => ({ ...prev, [workspace.id]: [] }))
        return
      }

      try {
        const client = createHttpClient(BASE_URL)
        const [remoteMembers, remoteInvites] = await Promise.all([
          listWorkspaceMembersApi(client, workspace.id),
          listWorkspaceInvites(client, workspace.id),
        ])

        const remoteSummaries = await Promise.all(
          remoteMembers.map(async (member) => ({
            id: member.userId,
            label:
              member.user?.displayName ??
              member.user?.username ??
              member.user?.email ??
              (await resolveUserLabel(member.userId)),
            role: member.role,
            assignments: tasks.filter((task) => task.assigneeUserId === member.userId).length,
          })),
        )
        setMembersByWorkspaceId((prev) => ({ ...prev, [workspace.id]: remoteSummaries }))
        setInvitesByWorkspaceId((prev) => ({ ...prev, [workspace.id]: remoteInvites }))
      } catch {
        setInvitesByWorkspaceId((prev) => ({ ...prev, [workspace.id]: [] }))
      }
    },
    [authSession.isAuthenticated],
  )

  useFocusEffect(
    useCallback(() => {
      void loadCards()
    }, [loadCards]),
  )

  useFocusEffect(
    useCallback(() => {
      const expandedWorkspace = workspaces.find((workspace) => workspace.id === expandedWorkspaceId)
      if (expandedWorkspace) {
        void loadManagementData(expandedWorkspace)
      }
    }, [expandedWorkspaceId, loadManagementData, workspaces]),
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

  const openProject = async (workspaceId: string) => {
    await setActiveWorkspaceId(workspaceId)
    navigation.navigate("ProjectDetail", { workspaceId })
  }

  const toggleManage = async (workspace: Workspace) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    const nextId = expandedWorkspaceId === workspace.id ? null : workspace.id
    setExpandedWorkspaceId(nextId)
    if (nextId) {
      await loadManagementData(workspace)
    }
  }

  const handleCreatePress = () => {
    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Sign in to create projects",
        "You're currently in guest mode. Sign in to create and sync projects.",
      )
      return
    }
    setCreateOpen(true)
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
    const error = validateLabel(renameLabel, renameTarget.id)
    if (error) {
      setFormError(error)
      return
    }
    await renameWorkspace(renameTarget.id, renameLabel.trim())
    setRenameTarget(null)
    setRenameLabel("")
    setFormError(null)
    await loadCards()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (authSession.isAuthenticated) {
      const client = createHttpClient(BASE_URL)
      await deleteWorkspaceApi(client, deleteTarget.id)
      await syncController.triggerSync("manual")
    }
    await deleteWorkspace(deleteTarget.id)
    setDeleteTarget(null)
    if (expandedWorkspaceId === deleteTarget.id) setExpandedWorkspaceId(null)
    await loadCards()
  }

  const handleInviteMember = async (workspace: Workspace) => {
    if (workspace.kind === "personal") return
    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Sign in to manage projects",
        "Guest mode supports local work, but project management requires an account.",
      )
      return
    }

    const trimmed = (inviteEmailByWorkspaceId[workspace.id] ?? "").trim().toLowerCase()
    if (!trimmed) {
      setFeedbackByWorkspaceId((prev) => ({ ...prev, [workspace.id]: "Enter an email to invite." }))
      return
    }

    try {
      const client = createHttpClient(BASE_URL)
      await inviteToWorkspace(client, workspace.id, trimmed, workspace.label)
      setInviteEmailByWorkspaceId((prev) => ({ ...prev, [workspace.id]: "" }))
      setFeedbackByWorkspaceId((prev) => ({ ...prev, [workspace.id]: "Invite sent." }))
      await loadManagementData(workspace)
    } catch (error) {
      setFeedbackByWorkspaceId((prev) => ({
        ...prev,
        [workspace.id]: error instanceof Error ? error.message : "Invite failed.",
      }))
    }
  }

  const handleRevokeInvite = (workspace: Workspace, invite: WorkspaceInvite) => {
    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Sign in to manage projects",
        "Guest mode supports local work, but project management requires an account.",
      )
      return
    }

    Alert.alert("Revoke invite?", `Revoke invite for ${invite.email}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              const client = createHttpClient(BASE_URL)
              await revokeWorkspaceInvite(client, workspace.id, invite.id)
              setFeedbackByWorkspaceId((prev) => ({ ...prev, [workspace.id]: "Invite revoked." }))
              await loadManagementData(workspace)
            } catch (error) {
              setFeedbackByWorkspaceId((prev) => ({
                ...prev,
                [workspace.id]: error instanceof Error ? error.message : "Revoke failed.",
              }))
            }
          })()
        },
      },
    ])
  }

  const handleRemoveMember = (workspace: Workspace, member: MemberSummary, ownerCount: number) => {
    if (!authSession.isAuthenticated) {
      Alert.alert(
        "Sign in to manage projects",
        "Guest mode supports local work, but project management requires an account.",
      )
      return
    }
    if (member.role === "OWNER" && ownerCount <= 1) return

    Alert.alert("Remove member?", `Remove ${member.label} from this project?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              const client = createHttpClient(BASE_URL)
              await removeWorkspaceMember(client, workspace.id, member.id)
              await syncController.triggerSync("manual")
              setFeedbackByWorkspaceId((prev) => ({ ...prev, [workspace.id]: "Member removed." }))
              await loadManagementData(workspace)
            } catch (error) {
              setFeedbackByWorkspaceId((prev) => ({
                ...prev,
                [workspace.id]: error instanceof Error ? error.message : "Remove failed.",
              }))
            }
          })()
        },
      },
    ])
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons
                name={"arrow-back"}
                size={25}
                color={theme.colors.text}
                style={{ padding: 5 }}
              />
            </TouchableOpacity>

            <Text preset="heading" text="Manage projects" />
          </View>
          <Text
            preset="caption"
            text="Open project workspaces fast, or expand a project card to manage its members, invites, and settings."
            style={themed($subtitle)}
          />
        </View>

        <Pressable onPress={handleCreatePress} style={themed($iconAction)}>
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

      {!authSession.isAuthenticated ? (
        <GlassCard>
          <View style={themed($guestNotice)}>
            <Text preset="formLabel" text="Sign in to manage projects" />
            <Text
              preset="caption"
              text="Guest mode still lets you open and work inside projects. Creation, membership, invites, and sync-enabled admin actions require login."
              style={themed($subtitle)}
            />
          </View>
        </GlassCard>
      ) : null}

      <View style={themed($cardsStack)}>
        {filteredCards.map((card) => {
          const isExpanded = expandedWorkspaceId === card.workspace.id
          const members = membersByWorkspaceId[card.workspace.id] ?? []
          const invites = invitesByWorkspaceId[card.workspace.id] ?? []
          const currentMemberRole =
            members.find((member) => member.id === authSession.currentUserId)?.role ?? null
          const ownerCount = members.filter((member) => member.role === "OWNER").length
          const canManageProject =
            authSession.isAuthenticated && ["OWNER", "ADMIN"].includes(currentMemberRole ?? "")
          const canDeleteProject = authSession.isAuthenticated && currentMemberRole === "OWNER"

          return (
            <ExpandableProjectCard
              key={card.workspace.id}
              card={card}
              isCurrent={card.workspace.id === activeWorkspaceId}
              isExpanded={isExpanded}
              members={members}
              invites={invites}
              inviteEmail={inviteEmailByWorkspaceId[card.workspace.id] ?? ""}
              feedback={feedbackByWorkspaceId[card.workspace.id] ?? null}
              canManageProject={canManageProject}
              canDeleteProject={canDeleteProject}
              authRestricted={!authSession.isAuthenticated}
              currentUserId={authSession.currentUserId}
              onOpen={() => void openProject(card.workspace.id)}
              onToggleManage={() => void toggleManage(card.workspace)}
              onRename={() => {
                setRenameTarget(card.workspace)
                setRenameLabel(card.workspace.label)
                setFormError(null)
              }}
              onInviteEmailChange={(value) => {
                setInviteEmailByWorkspaceId((prev) => ({ ...prev, [card.workspace.id]: value }))
                setFeedbackByWorkspaceId((prev) => ({ ...prev, [card.workspace.id]: null }))
              }}
              onInvite={() => void handleInviteMember(card.workspace)}
              onRevokeInvite={(invite) => handleRevokeInvite(card.workspace, invite)}
              onRemoveMember={(member) => handleRemoveMember(card.workspace, member, ownerCount)}
              onDelete={() => setDeleteTarget(card.workspace)}
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
        value={renameLabel}
        error={formError}
        confirmText="Save"
        onChangeText={(value) => {
          setRenameLabel(value)
          if (formError) setFormError(null)
        }}
        onClose={() => {
          setRenameTarget(null)
          setRenameLabel("")
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
                deleteTarget
                  ? `Delete ${deleteTarget.label}? This removes the project shell and its shared admin surface.`
                  : ""
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

function ExpandableProjectCard(props: {
  card: ProjectCard
  isCurrent: boolean
  isExpanded: boolean
  members: MemberSummary[]
  invites: WorkspaceInvite[]
  inviteEmail: string
  feedback: string | null
  canManageProject: boolean
  canDeleteProject: boolean
  authRestricted: boolean
  currentUserId?: string | null
  onOpen: () => void
  onToggleManage: () => void
  onRename: () => void
  onInviteEmailChange: (value: string) => void
  onInvite: () => void
  onRevokeInvite: (invite: WorkspaceInvite) => void
  onRemoveMember: (member: MemberSummary) => void
  onDelete: () => void
}) {
  const { themed } = useAppTheme()
  const ownerCount = props.members.filter((member) => member.role === "OWNER").length

  return (
    <GlassCard style={themed(props.isExpanded ? $projectCardExpanded : $projectCard)}>
      <View style={themed($projectMain)}>
        <View style={themed($projectTitleRow)}>
          <Text preset="formLabel" text={props.card.workspace.label} />
          {props.isCurrent ? (
            <Text preset="caption" text="Current" style={themed($currentBadge)} />
          ) : null}
          {props.isExpanded ? (
            <Text preset="caption" text="Managing" style={themed($expandedBadge)} />
          ) : null}
        </View>

        <Text
          preset="caption"
          text={
            props.card.workspace.kind === "personal"
              ? "Personal project"
              : `${props.card.workspace.membersCount ?? props.members.length} members · ${props.card.streamsCount} tracks`
          }
          style={themed($subtitle)}
        />

        <View style={themed($projectMetaRow)}>
          <ProjectStatPill label="Open" value={`${props.card.openTasks}`} />
          <ProjectStatPill label="Flow" value={`${props.card.inProgressTasks}`} />
          <ProjectStatPill label="Done" value={`${props.card.doneTasks}`} />
        </View>

        <View style={themed($cardActionRow)}>
          <Button text="Open" preset="glass" onPress={props.onOpen} style={themed($inlineAction)} />
          <Button
            text={props.isExpanded ? "Close" : "Manage"}
            onPress={props.onToggleManage}
            style={themed($inlineAction)}
          />
        </View>

        {props.isExpanded ? (
          <View style={themed($expandedContent)}>
            {props.authRestricted ? (
              <View style={themed($inlineNotice)}>
                <Text preset="caption" text="Guest mode" style={themed($metricLabel)} />
                <Text
                  preset="caption"
                  text="Open remains available. Project admin actions unlock after login."
                  style={themed($subtitle)}
                />
              </View>
            ) : null}

            <View style={themed($expandedSection)}>
              <SectionHeader title="General" subtitle="Project-level settings" />
              {props.card.workspace.kind === "personal" ? (
                <Text
                  preset="caption"
                  text="Personal projects stay local and do not support sharing, rename, or destructive admin controls."
                  style={themed($subtitle)}
                />
              ) : (
                <View style={themed($cardActionRow)}>
                  <Button
                    text="Rename project"
                    preset="glass"
                    onPress={props.onRename}
                    disabled={!props.canManageProject}
                    style={themed($inlineAction)}
                  />
                </View>
              )}
              {props.feedback ? (
                <Text preset="caption" text={props.feedback} style={themed($feedbackText)} />
              ) : null}
            </View>

            <View style={themed($expandedSection)}>
              <SectionHeader title="Members" subtitle="Admin and collaborator controls" />
              {props.members.length === 0 ? (
                <Text preset="caption" text="No synced members yet." style={themed($subtitle)} />
              ) : (
                props.members.map((member) => (
                  <View key={member.id} style={themed($managementRow)}>
                    <View style={themed($managementCopy)}>
                      <Text preset="caption" text={member.label} />
                      <Text
                        preset="caption"
                        text={`${member.role} · ${member.assignments} assigned`}
                        style={themed($subtitle)}
                      />
                    </View>
                    {props.canManageProject &&
                    member.id !== props.currentUserId &&
                    !(member.role === "OWNER" && ownerCount <= 1) ? (
                      <Button
                        text="Remove"
                        preset="glass"
                        onPress={() => props.onRemoveMember(member)}
                        style={themed($dangerAction)}
                      />
                    ) : null}
                  </View>
                ))
              )}
            </View>

            <View style={themed($expandedSection)}>
              <SectionHeader title="Invites" subtitle="Add and revoke access" />
              {props.card.workspace.kind === "personal" ? (
                <Text
                  preset="caption"
                  text="Personal projects cannot be shared."
                  style={themed($subtitle)}
                />
              ) : (
                <View style={themed($managementStack)}>
                  <TextField
                    value={props.inviteEmail}
                    onChangeText={props.onInviteEmailChange}
                    placeholder="teammate@company.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={props.canManageProject}
                  />
                  <Button
                    text="Send invite"
                    onPress={props.onInvite}
                    disabled={!props.canManageProject}
                  />
                  {props.invites.length === 0 ? (
                    <Text preset="caption" text="No pending invites." style={themed($subtitle)} />
                  ) : (
                    props.invites.map((invite) => (
                      <View key={invite.id} style={themed($managementRow)}>
                        <View style={themed($managementCopy)}>
                          <Text preset="caption" text={invite.email} />
                          <Text
                            preset="caption"
                            text={`${invite.role} · ${invite.status} · Expires ${formatDateTime(invite.expiresAt)}`}
                            style={themed($subtitle)}
                          />
                        </View>
                        {props.canManageProject && invite.status === "PENDING" ? (
                          <Button
                            text="Revoke"
                            preset="glass"
                            onPress={() => props.onRevokeInvite(invite)}
                            style={themed($dangerAction)}
                          />
                        ) : null}
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>

            {props.card.workspace.kind !== "personal" ? (
              <View style={themed($expandedSection)}>
                <SectionHeader title="Danger zone" subtitle="Destructive project actions" />
                <Button
                  text="Delete project"
                  preset="glass"
                  onPress={props.onDelete}
                  disabled={!props.canDeleteProject}
                  style={themed($dangerAction)}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </GlassCard>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($sectionHeader)}>
      <Text preset="caption" text={title} />
      <Text preset="caption" text={subtitle} style={themed($subtitle)} />
    </View>
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

const $guestNotice: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $cardsStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $projectCard: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $projectCardExpanded: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  gap: spacing.sm,
  borderColor: colors.primary,
})

const $projectMain: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $projectTitleRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $currentBadge: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.primary,
})

const $expandedBadge: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})

const $projectMetaRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
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

const $cardActionRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $inlineAction: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  minHeight: 38,
  justifyContent: "center",
  alignItems: "center",
  paddingVertical: spacing.xs,
  paddingHorizontal: spacing.md,
  overflow: "hidden",
  position: "relative",
})

const $expandedContent: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  gap: spacing.md,
  paddingTop: spacing.sm,
  borderTopWidth: 1,
  borderTopColor: colors.borderSubtle,
})

const $expandedSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xxxs,
})

const $inlineNotice: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  borderRadius: radius.medium,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: spacing.xxxs,
})

const $managementStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $managementRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $managementCopy: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxxs,
})

const $feedbackText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.primary,
})

const $dangerAction: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.danger,
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
