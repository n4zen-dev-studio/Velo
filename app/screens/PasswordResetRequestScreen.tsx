import { useState } from "react"
import { View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function PasswordResetRequestScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<AppStackScreenProps<"PasswordResetRequest">["navigation"]>()
  const { requestPasswordResetEmail } = useAuthViewModel()
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return
    await requestPasswordResetEmail(normalized)
    setMessage("If this email exists, a reset link was sent.")
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Reset password" />
        <Text preset="formHelper" text="Enter your email to receive a reset link." />
        <Text preset="formHelper" text="In development, the server prints the link in the console." />
      </View>

      <GlassCard>
        <Text preset="formLabel" text="Email" />
        <TextField value={email} onChangeText={setEmail} placeholder="you@company.com" autoCapitalize="none" />
        {message ? <Text preset="formHelper" text={message} /> : null}
        <View style={themed($buttonRow)}>
          <Button text="Send reset link" preset="default" onPress={handleSubmit} />
          <Button text="Back" preset="reversed" onPress={() => navigation.goBack()} />
        </View>
      </GlassCard>
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.lg,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginTop: spacing.md,
})
