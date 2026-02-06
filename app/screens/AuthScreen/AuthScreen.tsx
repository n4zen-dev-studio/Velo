import { useEffect, useMemo, useState } from "react"
import { Platform, View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"
import * as AppleAuthentication from "expo-apple-authentication"
import * as Google from "expo-auth-session/providers/google"
import LottieView from "lottie-react-native"

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
import { refreshAuthSession } from "@/services/auth/session"
import {
  claimOfflineData,
  discardGuestData,
  markOfflineClaimHandled,
  shouldPromptOfflineClaim,
} from "@/services/sync/offlineClaim"
import { syncController } from "@/services/sync/SyncController"
import { googleOauth, isValidGoogleClientId } from "@/config/oauth"
import { goToHome } from "@/navigation/navigationActions"
import { clearOfflineMode, setOfflineMode } from "@/services/storage/session"
import {
  personalWorkspaceId,
  setActiveWorkspaceId,
} from "@/services/db/repositories/workspacesRepository"
import { ensureBootstrappedForScope } from "@/services/db/bootstrap"
import { logScopeAction, withScopeTransitionLock } from "@/services/session/scopeTransition"
import { GUEST_SCOPE_KEY, userScopeKey } from "@/services/session/scope"

import { useAuthViewModel } from "./useAuthViewModel"

const ROBOT_ANIM = require("@assets/animations/robot.json")

export function AuthScreen() {
  const { themed, theme } = useAppTheme()
  const {
    offlineNotice,
    loginWithEmail,
    signupWithEmail,
    resendVerificationEmail,
    loginWithGoogle,
    loginWithApple,
  } = useAuthViewModel()
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
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

  // UI: pick a subtle accent based on your theme if it exists
  const accent = useMemo(() => {
    // If your theme has a known accent field, prefer it.
    // Fallbacks keep this safe even if fields don’t exist.
    return (
      // @ts-expect-error theme shape may vary
      theme?.colors?.tint ??
      // @ts-expect-error theme shape may vary
      theme?.colors?.primary ??
      "#7C5CFF"
    )
  }, [theme])

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
    const trimmedUsername = username.trim()
    if (!normalizedEmail || !password) {
      setError("Email and password are required.")
      return
    }
    if (trimmedUsername) {
      if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        setError("Username must be 3-20 characters.")
        return
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUsername)) {
        setError("Username can only use letters, numbers, dots, underscores, and dashes.")
        return
      }
    }
    try {
      const result = await signupWithEmail(normalizedEmail, password, trimmedUsername || undefined)
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
      setError(e?.response?.data?.error ?? `Sign up failed (${e?.response?.status ?? "no status"}).`)
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
    await withScopeTransitionLock(async () => {
      syncController.pause()
      logScopeAction("continue_offline", GUEST_SCOPE_KEY, userId)
      await setCurrentUserId(userId)
      await setSessionMode("local")
      await setOfflineMode(true)
      await refreshAuthSession()
      syncController.resume()
      goToHome()
    }, "continue_offline")
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
    await withScopeTransitionLock(async () => {
      syncController.pause()
      const scopeKey = userScopeKey(userId)
      logScopeAction("login_remote", scopeKey, userId)
      await setCurrentUserId(userId)
      await setSessionMode("remote")
      await clearOfflineMode()
      await refreshAuthSession()
      await ensureBootstrappedForScope(scopeKey)
      await setActiveWorkspaceId(personalWorkspaceId(scopeKey), scopeKey)
      syncController.resume()
      goToHome()
    }, "login_remote")
  }

  const handleClaimOfflineData = async () => {
    if (!pendingRemoteUserId) return
    await withScopeTransitionLock(async () => {
      syncController.pause()
      const scopeKey = userScopeKey(pendingRemoteUserId)
      logScopeAction("claim_offline_data", scopeKey, pendingRemoteUserId)
      await setCurrentUserId(pendingRemoteUserId)
      await setSessionMode("remote")
      await claimOfflineData(pendingRemoteUserId)
      markOfflineClaimHandled()
      setShowClaimModal(false)
      await clearOfflineMode()
      await refreshAuthSession()
      await ensureBootstrappedForScope(scopeKey)
      await setActiveWorkspaceId(personalWorkspaceId(scopeKey), scopeKey)
      syncController.resume()
      goToHome()
    }, "claim_offline_data")
    void syncController.triggerSync("manual")
  }

  const handleKeepSeparate = async () => {
    if (!pendingRemoteUserId) return
    await withScopeTransitionLock(async () => {
      syncController.pause()
      const scopeKey = userScopeKey(pendingRemoteUserId)
      logScopeAction("discard_offline_data", scopeKey, pendingRemoteUserId)
      await setCurrentUserId(pendingRemoteUserId)
      await setSessionMode("remote")
      await discardGuestData()
      markOfflineClaimHandled()
      setShowClaimModal(false)
      await clearOfflineMode()
      await refreshAuthSession()
      await ensureBootstrappedForScope(scopeKey)
      await setActiveWorkspaceId(personalWorkspaceId(scopeKey), scopeKey)
      syncController.resume()
      goToHome()
    }, "discard_offline_data")
  }

  return (
    <Screen preset="scroll" safeAreaEdges={['top', 'bottom']} contentContainerStyle={themed($screen)}>
      {/* HERO HEADER */}
      <View style={themed($hero)}>
        <View style={themed($heroGlowWrap)}>
          <View style={themed($heroGlow(accent))} />
          <View style={themed($heroRow)}>
            <View style={themed($robotWrap)}>
              <LottieView
                source={ROBOT_ANIM}
                autoPlay
                loop
                style={themed($robot)}
                // iOS sometimes needs hardware rendering off for Lottie depending on setup;
                // leaving default to avoid changing runtime behavior.
              />
            </View>

            <View style={themed($heroTextCol)}>
              <Text preset="heading" text="TaskTrak" />
              <Text preset="subheading" text="Offline-first Jira-lite" />
              <Text
                preset="formHelper"
                text="Sign in, or continue offline — your work stays on-device until you’re ready to sync."
              />
            </View>
          </View>
        </View>
      </View>

      {/* MAIN AUTH CARD */}
      <GlassCard>
        <View style={themed($cardHeader)}>
          <Text preset="formLabel" text="Welcome back" />
          <Text preset="formHelper" text="Use email/password, or a provider." />
        </View>

        <View style={themed($fieldBlock)}>
          <Text preset="formLabel" text="Email" />
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={themed($fieldBlock)}>
          <Text preset="formLabel" text="Username (optional)" />
          <TextField
            value={username}
            onChangeText={setUsername}
            placeholder="your_handle"
            autoCapitalize="none"
          />
        </View>

        <View style={themed($fieldBlock)}>
          <Text preset="formLabel" text="Password" />
          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
        </View>

        {(error || signupMessage) ? (
          <View style={themed($messageWrap)}>
            {error ? <Text preset="formHelper" text={error} /> : null}
            {signupMessage ? <Text preset="formHelper" text={signupMessage} /> : null}
          </View>
        ) : null}

        {/* PRIMARY ACTIONS */}
        <View style={themed($buttonStack)}>
          <Button text="Login" preset="default" onPress={handleLogin} />
          <Button text="Sign up" preset="reversed" onPress={handleSignup} />
        </View>

        {/* VERIFICATION ACTIONS */}
        {signupMessage ? (
          <View style={themed($buttonStackTight)}>
            <Button text="Resend verification email" preset="reversed" onPress={handleResendVerification} />
            <Button
              text="Enter verification token"
              preset="reversed"
              onPress={() => navigation.navigate("VerifyEmail", { email: email.trim().toLowerCase() })}
            />
          </View>
        ) : null}

        {/* SECONDARY */}
        <View style={themed($buttonStackTight)}>
          <Button
            text="Forgot password?"
            preset="reversed"
            onPress={() => navigation.navigate("PasswordResetRequest")}
          />
          <Button text="Continue Offline" preset="reversed" onPress={handleContinueOffline} />
        </View>

        {/* OAUTH */}
        <View style={themed($divider)} />
        <View style={themed($buttonStackTight)}>
          {showGoogleButton ? (
            <Button text="Continue with Google" preset="default" onPress={handleGoogleLogin} />
          ) : null}
          {showAppleButton ? (
            <Button text="Continue with Apple" preset="reversed" onPress={handleAppleLogin} />
          ) : null}
        </View>
      </GlassCard>

      {/* FOOTER NOTICE */}
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
  paddingTop: spacing.xl,
  gap: spacing.lg,
})

const $hero: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $heroGlowWrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  position: "relative",
  borderRadius: 24,
  overflow: "hidden",
  padding: spacing.lg,
})

const $heroGlow =
  (accent: string): ThemedStyle<ViewStyle> =>
  ({}) => ({
    position: "absolute",
    top: -120,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: accent,
    opacity: 0.18,
    transform: [{ scale: 1.05 }],
  })

const $heroRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.md,
})

const $robotWrap: ThemedStyle<ViewStyle> = ({}) => ({
  width: 86,
  height: 86,
  borderRadius: 22,
  overflow: "hidden",
})

const $robot: ThemedStyle<ViewStyle> = ({}) => ({
  width: 86,
  height: 86,
})

const $heroTextCol: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xs,
})

const $cardHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  marginBottom: spacing.sm,
})

const $fieldBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  marginTop: spacing.sm,
})

const $messageWrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  gap: spacing.xs,
  paddingVertical: spacing.xs,
})

const $buttonStack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.md,
  gap: spacing.sm,
})

const $buttonStackTight: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  gap: spacing.sm,
})

const $divider: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  height: 1,
  opacity: 0.18,
  marginTop: spacing.md,
  marginBottom: spacing.md,
  // Leave color to GlassCard background; divider reads as subtle line via opacity.
})
