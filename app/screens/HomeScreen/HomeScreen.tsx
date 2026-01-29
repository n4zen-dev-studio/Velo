import { View, ViewStyle } from "react-native"

import { GlassCard } from "@/components/GlassCard"
import { PriorityDot } from "@/components/PriorityDot"
import { Screen } from "@/components/Screen"
import { SyncStatusBadge } from "@/components/SyncStatusBadge"
import { Text } from "@/components/Text"
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { useHomeViewModel } from "./useHomeViewModel"

export function HomeScreen() {
  const { themed } = useAppTheme()
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, syncStatus, tasksByStatus } =
    useHomeViewModel()

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <View>
          <Text preset="heading" text="Home" />
          <Text preset="formHelper" text="Personal workspace by default" />
        </View>
        <SyncStatusBadge status={syncStatus} />
      </View>

      <WorkspaceSwitcher
        options={workspaces.map((workspace) => ({
          id: workspace.id,
          label: workspace.label,
          subtitle: workspace.projectId ? "Project" : "Personal",
        }))}
        activeId={activeWorkspaceId}
        onSelect={setActiveWorkspaceId}
      />

      {tasksByStatus.map(({ status, tasks }) => (
        <View key={status.id} style={themed($section)}>
          <View style={themed($sectionHeader)}>
            <Text preset="subheading" text={status.name} />
            <Text preset="formHelper" text={`${tasks.length} tasks`} />
          </View>
          {tasks.length === 0 ? (
            <GlassCard>
              <Text preset="formHelper" text="No tasks in this lane yet." />
            </GlassCard>
          ) : (
            tasks.map((task) => (
              <GlassCard key={task.id}>
                <View style={themed($taskRow)}>
                  <PriorityDot priority={task.priority} />
                  <Text preset="subheading" text={task.title} />
                </View>
                <Text preset="formHelper" text={task.description} />
              </GlassCard>
            ))
          )}
        </View>
      ))}
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingBottom: spacing.xl,
  gap: spacing.lg,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const $section: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  gap: spacing.sm,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: spacing.xs,
})

const $taskRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  marginBottom: spacing.xs,
})
