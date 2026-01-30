import { useState } from "react"
import { View, ViewStyle } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { setTokens } from "@/services/api/tokenStore"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"
import { setCurrentUserId, setSessionMode } from "@/services/sync/identity"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function VerifyEmailScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<AppStackScreenProps<"VerifyEmail">["navigation"]>()
  const route = useRoute<AppStackScreenProps<"VerifyEmail">["route"]>()
  const { email, password } = route.params
  const { loginWithEmail, resendVerificationEmail } = useAuthViewModel()
  const [message, setMessage] = useState<string | null>(null)

  const handleResend = async () => {
    await resendVerificationEmail(email)
    setMessage("Verification email resent.")
  }

  const handleContinue = async () => {
    try {
      const auth = await loginWithEmail(email, password)
      await setTokens(auth.accessToken, auth.refreshToken)
      const userId = parseUserIdFromJwt(auth.accessToken)
      if (!userId) {
        setMessage("Unable to read session. Please try again.")
        return
      }
      await setCurrentUserId(userId)
      await setSessionMode("remote")
      navigation.reset({ index: 0, routes: [{ name: "Home" }] })
    } catch (err: any) {
      if (err?.type === "EMAIL_NOT_VERIFIED") {
        setMessage("Email not verified yet.")
        return
      }
      setMessage("Login failed. Please try again.")
    }
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Verify your email" />
        <Text preset="formHelper" text="We sent you a verification link. Open it, then return here." />
        <Text preset="formHelper" text="In development, the server prints the link in the console." />
      </View>

      <GlassCard>
        {message ? <Text preset="formHelper" text={message} /> : null}
        <View style={themed($buttonRow)}>
          <Button text="Resend email" preset="default" onPress={handleResend} />
          <Button text="I verified, continue" preset="reversed" onPress={handleContinue} />
        </View>
        <View style={themed($buttonRow)}>
          <Button text="Back to login" preset="reversed" onPress={() => navigation.goBack()} />
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

function parseUserIdFromJwt(token: string) {
  try {
    const payload = token.split(".")[1]
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : // @ts-expect-error Buffer may exist in RN
          Buffer.from(padded, "base64").toString("binary")
    const data = JSON.parse(decoded)
    return data.sub as string | undefined
  } catch {
    return undefined
  }
}
