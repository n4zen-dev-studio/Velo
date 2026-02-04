import React, { useMemo, useState } from "react"
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  ViewStyle,
  TextStyle,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { PriorityDot } from "@/components/PriorityDot"
import { Screen } from "@/components/Screen"
import { SyncBadge } from "@/components/SyncBadge"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { goToSettingsTab } from "@/navigation/navigationActions"

import { useHomeViewModel } from "./useHomeViewModel"

export function HomeScreen() {
  const { themed, toggleTheme } = useAppTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<HomeStackScreenProps<"Home">["navigation"]>()

  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    tasksByStatus,
    refreshAll,
    isRefreshing,
  } = useHomeViewModel()

  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0]
  }, [workspaces, activeWorkspaceId])

  const fabBottom = Math.max(insets.bottom, 0) + 16

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={themed($screen)}>
      {/* Header */}
      <View style={themed($header)}>
        <View style={themed($titleBlock)}>
          <Text preset="heading" text="Home" />
          {/* Single workspace indicator (button opens dropdown) */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setWorkspaceMenuOpen(true)}
            style={themed($workspacePill)}
            hitSlop={10}
          >
            <Text
              preset="formHelper"
              text={activeWorkspace?.label ?? "Workspace"}
              style={themed($workspacePillText)}
              numberOfLines={1}
            />
            <Text preset="subheading" text="▾" style={themed($chev)} />
          </Pressable>
        </View>

        <View style={themed($headerActions)}>
          <SyncBadge />
        </View>
      </View>

      {/* Temporary test button (keep as requested) */}
      {/* <View style={themed($tempRow)}>
        <Button tx="welcomeScreen:SwitchTheme" onPress={toggleTheme} />
      </View> */}

      {/* Scroll content */}
      <ScrollView
        contentContainerStyle={themed($scrollContent)}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} />}
        showsVerticalScrollIndicator={false}
      >
        {tasksByStatus.map(({ status, tasks }) => (
          <View
            key={`${status.workspaceId}:${status.projectId ?? "personal"}:${status.id}`}
            style={themed($section)}
          >
            <View style={themed($sectionHeader)}>
              <Text preset="subheading" text={status.name} />
              <Text preset="formHelper" text={`${tasks.length} tasks`} />
            </View>

            {tasks.length === 0 ? (
              <GlassCard>
                <Text preset="formHelper" text="No tasks in this lane yet." />
              </GlassCard>
            ) : (
              <View style={themed($cardsCol)}>
                {tasks.map((task) => (
                  <Pressable
                    key={`${task.workspaceId}:${task.projectId ?? "personal"}:${task.id}`}
                    onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}
                    style={themed($pressableCard)}
                  >
                    <GlassCard>
                      <View style={themed($taskRow)}>
                        <PriorityDot priority={task.priority} />
                        <Text preset="subheading" text={task.title} style={themed($taskTitle)} />
                      </View>
                      {!!task.description && (
                        <Text preset="formHelper" text={task.description} style={themed($taskDesc)} />
                      )}
                    </GlassCard>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* spacer so last content doesn’t hide behind FAB */}
        <View style={{ height: 90 + fabBottom }} />
      </ScrollView>

      {/* Sticky FAB (outside ScrollView so it does NOT scroll) */}
      <Pressable
        accessibilityRole="button"
        style={[themed($fab), { bottom: fabBottom }]}
        onPress={() => navigation.navigate("TaskEditor")}
      >
        <Text preset="heading" text="+" />
      </Pressable>

      {/* Workspace dropdown */}
      <Modal visible={workspaceMenuOpen} transparent animationType="fade" onRequestClose={() => setWorkspaceMenuOpen(false)}>
        <Pressable style={themed($modalBackdrop)} onPress={() => setWorkspaceMenuOpen(false)}>
          <Pressable style={themed($menuCard)} onPress={() => {}}>
            <View style={themed($menuHeader)}>
              <Text preset="subheading" text="Workspaces" />
              <Pressable onPress={() => setWorkspaceMenuOpen(false)} hitSlop={10}>
                <Text preset="formHelper" text="Close" />
              </Pressable>
            </View>

            <View style={themed($menuList)}>
              {workspaces.map((w) => {
                const isActive = w.id === activeWorkspaceId
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => {
                      setWorkspaceMenuOpen(false)
                      void (async () => {
                        try {
                          await setActiveWorkspaceId(w.id)
                        } catch (error) {
                          console.warn("[Workspace] Failed to switch workspace", error)
                        }
                      })()
                    }}
                    style={themed(isActive ? $menuItemActive : $menuItem)}
                  >
                    <View style={themed($menuItemLeft)}>
                      <Text preset="subheading" text={w.label} />
                      {/* <Text preset="formHelper" text={w.projectId ? "Project" : "Personal"} /> */}
                    </View>
                    {isActive ? <Text preset="formHelper" text="✓" /> : null}
                  </Pressable>
                )
              })}
            </View>

            <View style={themed($menuFooter)}>
              {/* “Create workspace” entry near the dropdown, as requested.
                  Re-using settings tab as the safest existing flow without breaking the app. */}
              <Button
                text="Create workspace"
                preset="reversed"
                onPress={() => {
                  setWorkspaceMenuOpen(false)
                  goToSettingsTab()
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.md,
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing.md,
})

const $titleBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xs,
})

const $headerActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $tempRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.sm,
})

const $scrollContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.lg,
  paddingBottom: spacing.xl,
  gap: spacing.lg,
})

const $workspacePill: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  alignSelf: "flex-start",
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background, // works well with your glass theme (and stays readable)
})

const $workspacePillText: ThemedStyle<TextStyle> = () => ({
  maxWidth: 220,
})

const $chev: ThemedStyle<TextStyle> = () => ({
  opacity: 0.8,
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

const $cardsCol: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $pressableCard: ThemedStyle<ViewStyle> = () => ({
  // keeps press area clean without changing your GlassCard component
})

const $taskRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  marginBottom: spacing.xs,
})

const $taskTitle: ThemedStyle<TextStyle> = () => ({
  flex: 1,
})

const $taskDesc: ThemedStyle<TextStyle> = () => ({
  opacity: 0.9,
})

const $fab: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: "absolute",
  right: spacing.lg,
  width: 56,
  height: 56,
  borderRadius: 28,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.palette.primary500,
  shadowColor: colors.palette.neutral900,
  shadowOpacity: 0.2,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,
})

const $modalBackdrop: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.35)",
  justifyContent: "center",
  padding: 16,
})

const $menuCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  borderRadius: 20,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.background,
  padding: spacing.md,
  gap: spacing.md,
})

const $menuHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
})

const $menuList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $menuItem: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.border,
})

const $menuItemActive: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.palette.primary500,
})

const $menuItemLeft: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $menuFooter: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingTop: spacing.xs,
})
