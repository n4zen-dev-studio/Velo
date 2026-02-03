import { Pressable, RefreshControl, View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"

import { GlassCard } from "@/components/GlassCard"
import { PriorityDot } from "@/components/PriorityDot"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { goToSettingsTab, goToDebugTab } from "@/navigation/navigationActions"
import { SyncBadge } from "@/components/SyncBadge"

import { useHomeViewModel } from "./useHomeViewModel"

export function HomeScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<HomeStackScreenProps<"Home">["navigation"]>()
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, tasksByStatus, refreshAll, isRefreshing, activeProjectId } =
    useHomeViewModel()

  return (
    <Screen
      preset="scroll"
      contentContainerStyle={themed($screen)}
      ScrollViewProps={{
        refreshControl: <RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} />,
      }}
    >
      <View style={themed($header)}>
        <View>
          <Text preset="heading" text="Home" />
          <Text preset="formHelper" text="Personal workspace by default" />
        </View>
        <View style={themed($headerActions)}>
          <Pressable onPress={goToSettingsTab}>
            <Text preset="formLabel" text="Settings" />
          </Pressable>
          <Pressable onPress={goToDebugTab}>
            <Text preset="formLabel" text="Debug" />
          </Pressable>
          <SyncBadge />
        </View>
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
        <View key={`${status.projectId ?? "personal"}:${status.id}`} style={themed($section)}>
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
              <Pressable
                key={`${task.projectId ?? "personal"}:${task.id}`}
                onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
              >
                <GlassCard>
                  <View style={themed($taskRow)}>
                    <PriorityDot priority={task.priority} />
                    <Text preset="subheading" text={task.title} />
                  </View>
                  <Text preset="formHelper" text={task.description} />
                </GlassCard>
              </Pressable>
            ))
          )}
        </View>
      ))}

      <Pressable
        style={themed($fab)}
        onPress={() => navigation.navigate("TaskEditor", { projectId: activeProjectId ?? undefined })}
      >
        <Text preset="heading" text="+" />
      </Pressable>
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

const $headerActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
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

const $fab: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: "absolute",
  right: spacing.lg,
  bottom: spacing.xl,
  width: 56,
  height: 56,
  borderRadius: 28,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.palette.primary400,
  shadowColor: colors.palette.neutral900,
  shadowOpacity: 0.2,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
})
