import { Pressable, ScrollView, TextStyle, View, ViewStyle } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export interface WorkspaceOption {
  id: string
  label: string
  subtitle?: string
}

interface WorkspaceSwitcherProps {
  options: WorkspaceOption[]
  activeId: string
  onSelect: (id: string) => void
}

export function WorkspaceSwitcher({ options, activeId, onSelect }: WorkspaceSwitcherProps) {
  const { themed } = useAppTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={themed($list)}
    >
      {options.map((option) => {
        const isActive = option.id === activeId
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[themed($chip), isActive && themed($chipActive)]}
          >
            <Text preset={isActive ? "subheading" : "formLabel"} text={option.label} />
            {option.subtitle ? (
              <Text preset="formHelper" text={option.subtitle} style={themed($chipSubtitle)} />
            ) : null}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const $list: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  gap: spacing.sm,
})

const $chip: ThemedStyle<ViewStyle> = ({ colors, spacing, radius }) => ({
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderRadius: radius.large,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  backgroundColor: colors.surface,
  minWidth: 120,
})

const $chipActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.primary,
  backgroundColor: colors.glowSoft,
})

const $chipSubtitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})
