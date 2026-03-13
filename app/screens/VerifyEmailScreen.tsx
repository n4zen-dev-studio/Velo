import { useState } from "react"
import { View, ViewStyle } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { ClaimOfflineDataModal } from "@/components/ClaimOfflineDataModal"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { goToHome } from "@/navigation/navigationActions"
import type { AuthStackScreenProps } from "@/navigators/navigationTypes"
import { useAuthViewModel } from "@/screens/AuthScreen/useAuthViewModel"
import {
  claimPendingOfflineData,
  finalizeRemoteLogin,
  keepRemoteDataSeparate,
  prepareRemoteLogin,
} from "@/services/auth/completeRemoteLogin"
import { syncController } from "@/services/sync/SyncController"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export function VerifyEmailScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<AuthStackScreenProps<"VerifyEmail">["navigation"]>()
  const route = useRoute<AuthStackScreenProps<"VerifyEmail">["route"]>()
  const email = route.params?.email ?? ""
  const { bootstrapAfterLogin } = useWorkspaceStore()
  const { resendVerificationEmail, verifyEmailWithToken } = useAuthViewModel()
  const [message, setMessage] = useState<string | null>(null)
  const [token, setToken] = useState(route.params?.token ?? "")
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [pendingRemoteUserId, setPendingRemoteUserId] = useState<string | null>(null)

  const handleResend = async () => {
    const result = await resendVerificationEmail(email)
    setMessage(
      result.previewToken
        ? "Verification details refreshed. Continue below."
        : "Verification email resent. Check your inbox.",
    )
    if (result.previewToken) {
      setToken(result.previewToken)
    }
  }

  const handleContinue = async () => {
    try {
      if (!token.trim()) {
        setMessage("Enter your verification token.")
        return
      }
      const auth = await verifyEmailWithToken(token.trim())
      await completeRemoteAuth(auth.accessToken, auth.refreshToken)
    } catch {
      setMessage("Verification failed. Please try again.")
    }
  }

  const completeRemoteAuth = async (accessToken: string, refreshToken: string) => {
    const result = await prepareRemoteLogin(accessToken, refreshToken)
    if (!result.userId) {
      setMessage("Unable to read session. Please try again.")
      return
    }
    if (result.needsClaim) {
      setPendingRemoteUserId(result.userId)
      setShowClaimModal(true)
      return
    }
    await finalizeRemoteAuth(result.userId)
  }

  const finalizeRemoteAuth = async (userId: string) => {
    await finalizeRemoteLogin(userId, "verify_login_remote")
    await bootstrapAfterLogin()
    goToHome()
  }

  const handleClaimOfflineData = async () => {
    if (!pendingRemoteUserId) return
    await claimPendingOfflineData(pendingRemoteUserId, "verify_claim_offline_data")
    setShowClaimModal(false)
    await bootstrapAfterLogin()
    goToHome()
    void syncController.triggerSync("manual")
  }

  const handleKeepSeparate = async () => {
    if (!pendingRemoteUserId) return
    await keepRemoteDataSeparate(pendingRemoteUserId, "verify_discard_offline_data")
    setShowClaimModal(false)
    await bootstrapAfterLogin()
    goToHome()
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <Text preset="heading" text="Verify your email" />
        <Text
          preset="formHelper"
          text="Check your inbox for the verification token or continue with the preview token shown during development."
        />
      </View>

      <GlassCard>
        <Text preset="formLabel" text="Verification token" />
        <TextField
          value={token}
          onChangeText={setToken}
          placeholder="token"
          autoCapitalize="none"
        />
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
