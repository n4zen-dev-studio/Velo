import { useEffect, useState } from "react"
import { Platform, View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"
import * as AppleAuthentication from "expo-apple-authentication"
import * as Google from "expo-auth-session/providers/google"

import { Button } from "@/components/Button"
import { ClaimOfflineDataModal } from "@/components/ClaimOfflineDataModal"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { AuthStackScreenProps } from "@/navigators/navigationTypes"
import {
  deriveUserIdFromEmail,
  generateUuidV4,
  setCurrentUserId,
  setSessionMode,
} from "@/services/sync/identity"
import { setTokens } from "@/services/api/tokenStore"
import { claimOfflineData, markOfflineClaimHandled, shouldPromptOfflineClaim } from "@/services/sync/offlineClaim"
import { syncController } from "@/services/sync/SyncController"
import { googleOauth, isValidGoogleClientId } from "@/config/oauth"
import { goToHome } from "@/navigation/navigationActions"
import { clearOfflineMode, setOfflineMode } from "@/services/storage/session"

import { useAuthViewModel } from "./useAuthViewModel"

export function AuthScreen() {
  const { themed } = useAppTheme()
  const {
    offlineNotice,
    loginWithEmail,
    signupWithEmail,
    resendVerificationEmail,
    loginWithGoogle,
    loginWithApple,
  } = useAuthViewModel()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [signupMessage, setSignupMessage] = useState<string | null>(null)
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [pendingRemoteUserId, setPendingRemoteUserId] = useState<string | null>(null)
  const navigation = useNavigation<AuthStackScreenProps<"Auth">["navigation"]>()

  const googleConfig = {
    androidClientId: googleOauth.androidClientId,
    iosClientId: googleOauth.iosClientId,
    webClientId: googleOauth.webClientId,
  }
  const isGoogleConfigured = isValidGoogleClientId(
    Platform.OS === "ios" ? googleConfig.iosClientId : googleConfig.androidClientId,
  )
  const showGoogleButton = isGoogleConfigured
  const showAppleButton = Platform.OS === "ios"
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleConfig)

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type !== "success") return
      const idToken = response.authentication?.idToken
      if (!idToken) {
        setError("Google login failed. Please try again.")
        return
      }
      try {
        const auth = await loginWithGoogle(idToken)
        await completeRemoteLogin(auth.accessToken, auth.refreshToken)
      } catch {
        setError("Google login failed. Please try again.")
      }
    }
    void handleGoogleResponse()
  }, [response])

  const handleLogin = async () => {
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError("Email and password are required.")
      return
    }
    try {
      const auth = await loginWithEmail(normalizedEmail, password)
      await completeRemoteLogin(auth.accessToken, auth.refreshToken)
    } catch (err: any) {
      if (err?.type === "EMAIL_NOT_VERIFIED") {
        navigation.navigate("VerifyEmail", { email: normalizedEmail })
        return
      }
      if (err?.type === "INVALID_CREDENTIALS") {
        setError("Invalid email or password.")
        return
      }
      setError("Login failed. Please try again.")
    }
  }

  const handleSignup = async () => {
    setError(null)
    setSignupMessage(null)
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError("Email and password are required.")
      return
    }
    try {
      const result = await signupWithEmail(normalizedEmail, password)
      if (result.needsVerification) {
        setSignupMessage("Check your email to verify your account.")
      }
    } catch (e: any) {
      console.log("SIGNUP ERROR", {
        message: e?.message,
        status: e?.response?.status,
        data: e?.response?.data,
        baseURL: e?.config?.baseURL,
        url: e?.config?.url,
      })
      setError(
        e?.response?.data?.error ??
          `Sign up failed (${e?.response?.status ?? "no status"}).`
      )
    }
  }

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError("Enter your email to resend verification.")
      return
    }
    await resendVerificationEmail(normalizedEmail)
    setSignupMessage("Verification email resent. Check the server console for the token.")
  }

  const handleGoogleLogin = async () => {
    setError(null)
    if (!request || !isGoogleConfigured) {
      setError("Google login is not configured.")
      return
    }
    await promptAsync()
  }

  const handleAppleLogin = async () => {
    setError(null)
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      })
      if (!credential.identityToken) {
        setError("Apple login failed. Please try again.")
        return
      }
      const auth = await loginWithApple(credential.identityToken)
      await completeRemoteLogin(auth.accessToken, auth.refreshToken)
    } catch (err: any) {
      if (err?.code === "ERR_CANCELED") return
      setError("Apple login failed. Please try again.")
    }
  }

  const handleContinueOffline = async () => {
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    const userId = normalizedEmail ? await deriveUserIdFromEmail(normalizedEmail) : await generateUuidV4()
    await setCurrentUserId(userId)
    await setSessionMode("local")
    await setOfflineMode(true)
    goToHome()
  }

  const completeRemoteLogin = async (accessToken: string, refreshToken: string) => {
    await setTokens(accessToken, refreshToken)
    const userId = parseUserIdFromJwt(accessToken)
    if (!userId) {
      setError("Unable to read user session. Please try again.")
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
    goToHome()
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="TaskTrak" />
        <Text preset="subheading" text="Offline-first Jira-lite" />
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
        <View style={themed($spacer)} />
        <Text preset="formLabel" text="Password" />
        <TextField value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
        {error ? <Text preset="formHelper" text={error} /> : null}
        {signupMessage ? <Text preset="formHelper" text={signupMessage} /> : null}
        <View style={themed($buttonRow)}>
          <Button text="Login" preset="default" onPress={handleLogin} />
          <Button text="Sign up" preset="reversed" onPress={handleSignup} />
        </View>
        {signupMessage ? (
          <View style={themed($buttonRow)}>
            <Button
              text="Resend verification email"
              preset="reversed"
              onPress={handleResendVerification}
            />
            <Button
              text="Enter verification token"
              preset="reversed"
              onPress={() => navigation.navigate("VerifyEmail", { email: email.trim().toLowerCase() })}
            />
          </View>
        ) : null}
        <View style={themed($buttonRow)}>
          <Button
            text="Forgot password?"
            preset="reversed"
            onPress={() => navigation.navigate("PasswordResetRequest")}
          />
        </View>
        <View style={themed($buttonRow)}>
          <Button text="Continue Offline" preset="reversed" onPress={handleContinueOffline} />
        </View>
        <View style={themed($buttonRow)}>
          {showGoogleButton ? (
            <Button text="Continue with Google" preset="default" onPress={handleGoogleLogin} />
          ) : null}
          {showAppleButton ? (
            <Button text="Continue with Apple" preset="reversed" onPress={handleAppleLogin} />
          ) : null}
        </View>
      </GlassCard>

      <GlassCard>
        <Text preset="formHelper" text={offlineNotice} />
      </GlassCard>

      <ClaimOfflineDataModal
        visible={showClaimModal}
        onClaim={handleClaimOfflineData}
        onKeepSeparate={handleKeepSeparate}
      />
    </Screen>
  )
}

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

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.lg,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $spacer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  height: spacing.sm,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginTop: spacing.md,
})
