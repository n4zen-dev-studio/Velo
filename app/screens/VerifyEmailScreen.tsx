import { useState } from "react"
import { View, ViewStyle } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { ClaimOfflineDataModal } from "@/components/ClaimOfflineDataModal"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { AuthStackScreenProps } from "@/navigators/navigationTypes"
import { setTokens } from "@/services/api/tokenStore"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"
import { setCurrentUserId, setSessionMode } from "@/services/sync/identity"
import { claimOfflineData, markOfflineClaimHandled, shouldPromptOfflineClaim } from "@/services/sync/offlineClaim"
import { syncController } from "@/services/sync/SyncController"
import { goToHome } from "@/navigation/navigationActions"
import { clearOfflineMode } from "@/services/storage/session"
import { refreshAuthSession } from "@/services/auth/session"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function VerifyEmailScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<AuthStackScreenProps<"VerifyEmail">["navigation"]>()
  const route = useRoute<AuthStackScreenProps<"VerifyEmail">["route"]>()
  const email = route.params?.email ?? ""
  const { resendVerificationEmail, verifyEmailWithToken } = useAuthViewModel()
  const [message, setMessage] = useState<string | null>(null)
  const [token, setToken] = useState("")
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [pendingRemoteUserId, setPendingRemoteUserId] = useState<string | null>(null)

  const handleResend = async () => {
    await resendVerificationEmail(email)
    setMessage("Verification email resent.")
  }

  const handleContinue = async () => {
    try {
      if (!token.trim()) {
        setMessage("Enter your verification token.")
        return
      }
      const auth = await verifyEmailWithToken(token.trim())
      await completeRemoteLogin(auth.accessToken, auth.refreshToken)
    } catch (err: any) {
      setMessage("Verification failed. Please try again.")
    }
  }

  const completeRemoteLogin = async (accessToken: string, refreshToken: string) => {
    await setTokens(accessToken, refreshToken)
    const userId = parseUserIdFromJwt(accessToken)
    if (!userId) {
      setMessage("Unable to read session. Please try again.")
      return
    }
    const needsClaim = await shouldPromptOfflineClaim()
    if (needsClaim) {
      setPendingRemoteUserId(userId)
      setShowClaimModal(true)
      return
    }
    await finalizeRemoteLogin(userId)
  }

  const finalizeRemoteLogin = async (userId: string) => {
    await setCurrentUserId(userId)
    await setSessionMode("remote")
    await clearOfflineMode()
    await refreshAuthSession()
    goToHome()
  }

  const handleClaimOfflineData = async () => {
    if (!pendingRemoteUserId) return
    await setCurrentUserId(pendingRemoteUserId)
    await setSessionMode("remote")
    await claimOfflineData(pendingRemoteUserId)
    markOfflineClaimHandled()
    setShowClaimModal(false)
    await clearOfflineMode()
    await refreshAuthSession()
    goToHome()
    void syncController.triggerSync("manual")
  }

  const handleKeepSeparate = async () => {
    if (!pendingRemoteUserId) return
    await setCurrentUserId(pendingRemoteUserId)
    await setSessionMode("remote")
    markOfflineClaimHandled()
    setShowClaimModal(false)
    await clearOfflineMode()
    await refreshAuthSession()
    goToHome()
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Verify your email" />
        <Text preset="formHelper" text="Check your email for the verification token, then enter it below." />
        <Text preset="formHelper" text="In development, the server prints the token in the console." />
      </View>

      <GlassCard>
        <Text preset="formLabel" text="Verification token" />
        <TextField value={token} onChangeText={setToken} placeholder="token" autoCapitalize="none" />
        {message ? <Text preset="formHelper" text={message} /> : null}
        <View style={themed($buttonRow)}>
          <Button text="Resend email" preset="default" onPress={handleResend} />
          <Button text="Verify & continue" preset="reversed" onPress={handleContinue} />
        </View>
        <View style={themed($buttonRow)}>
          <Button text="Back to login" preset="reversed" onPress={() => navigation.goBack()} />
        </View>
      </GlassCard>

      <ClaimOfflineDataModal
        visible={showClaimModal}
        onClaim={handleClaimOfflineData}
        onKeepSeparate={handleKeepSeparate}
      />
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
