import { useCallback, useEffect } from "react"
import { TextStyle, View, ViewStyle } from "react-native"
import { useFocusEffect, useNavigation } from "@react-navigation/native"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { ProjectsStackScreenProps } from "@/navigators/navigationTypes"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function ProjectsEntryScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<ProjectsStackScreenProps<"ProjectsEntry">["navigation"]>()
  const { activeWorkspace, workspaces, isHydrated } = useWorkspaceStore()

  const activeWorkspaceId = activeWorkspace?.id
  const firstWorkspaceId = workspaces[0]?.id

  useEffect(() => {
    if (!isHydrated) return

    console.log("activeWorkspace name",activeWorkspace?.label)

    const targetWorkspaceId = activeWorkspaceId ?? firstWorkspaceId

    if (targetWorkspaceId) {
      navigation.replace("ProjectDetail", { workspaceId: targetWorkspaceId })
      return
    }

    navigation.replace("ProjectsHome")
  }, [activeWorkspaceId, firstWorkspaceId, isHydrated, navigation])


  return (
    <Screen
      preset="fixed"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($loadingCard)}>
        <Text preset="overline" text="Projects" />
        <Text preset="heading" text="Opening workspace" />
        <Text
          preset="caption"
          text="Loading your current project board."
          style={themed($subtitle)}
        />
      </View>
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: spacing.screenHorizontal,
})

const $loadingCard: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  width: "100%",
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surfaceGlass,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.lg,
  gap: spacing.xs,
  alignItems: "center",
})

const $subtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})
