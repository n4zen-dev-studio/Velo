import { useState } from "react"
import { View, ViewStyle } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { AuthStackScreenProps } from "@/navigators/navigationTypes"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function PasswordResetConfirmScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<AuthStackScreenProps<"PasswordResetConfirm">["navigation"]>()
  const route = useRoute<AuthStackScreenProps<"PasswordResetConfirm">["route"]>()
  const { confirmPasswordResetToken } = useAuthViewModel()
  const [token, setToken] = useState(route.params?.token ?? "")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!token || !password) return
    await confirmPasswordResetToken(token, password)
    setMessage("Password updated. Return to sign in with your new password.")
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Set new password" />
        <Text
          preset="formHelper"
          text="Paste your reset token and choose a new password, or continue with the preview token already filled in."
        />
      </View>

      <GlassCard>
        <Text preset="formLabel" text="Reset token" />
        <TextField
          value={token}
          onChangeText={setToken}
          placeholder="token"
          autoCapitalize="none"
        />
        <Text preset="formLabel" text="New password" />
        <TextField
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
        {message ? <Text preset="formHelper" text={message} /> : null}
        <View style={themed($buttonRow)}>
          <Button text="Update password" preset="default" onPress={handleSubmit} />
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
