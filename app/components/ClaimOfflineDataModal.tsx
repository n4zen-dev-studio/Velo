import { Modal, View, ViewStyle } from "react-native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

interface ClaimOfflineDataModalProps {
  visible: boolean
  onClaim: () => void
  onKeepSeparate: () => void
}

export function ClaimOfflineDataModal({
  visible,
  onClaim,
  onKeepSeparate,
}: ClaimOfflineDataModalProps) {
  const { themed } = useAppTheme()

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={themed($backdrop)}>
        <GlassCard style={themed($card)}>
          <Text preset="heading" text="Claim guest data?" />
          <Text
            preset="formHelper"
            text="You have offline work on this device. Claim it for this account or discard it."
          />
          <View style={themed($buttonRow)}>
            <Button text="Claim & sync" preset="default" onPress={onClaim} />
            <Button text="Discard guest data" preset="reversed" onPress={onKeepSeparate} />
          </View>
        </GlassCard>
      </View>
    </Modal>
  )
}

const $backdrop: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  padding: 24,
  backgroundColor: colors.palette.overlay50,
})

const $card: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "100%",
  gap: spacing.md,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})
