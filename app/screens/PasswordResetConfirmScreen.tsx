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
  const [email, setEmail] = useState(route.params?.email ?? "")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !code || !password) return
    try {
      await confirmPasswordResetToken(normalizedEmail, code.trim(), password)
      setMessage("Password updated. Return to sign in with your new password.")
    } catch {
      setMessage("Reset failed. Check your code and try again.")
    }
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Set new password" />
        <Text
          preset="formHelper"
          text="Enter your email, the 6-digit reset code from your inbox, and your new password."
        />
      </View>

      <GlassCard>
        <Text preset="formLabel" text="Email" />
        <TextField
          value={email}
          onChangeText={setEmail}
          placeholder="you@company.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text preset="formLabel" text="Reset code" />
        <TextField
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          autoCapitalize="none"
          keyboardType="number-pad"
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
