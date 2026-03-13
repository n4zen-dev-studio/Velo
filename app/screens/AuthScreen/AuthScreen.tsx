import { useCallback, useEffect, useMemo, useState } from "react"
import { Image, Platform, View, ViewStyle, TextStyle } from "react-native"
import * as AppleAuthentication from "expo-apple-authentication"
import { useNavigation } from "@react-navigation/native"
import * as Google from "expo-auth-session/providers/google"
import LottieView from "lottie-react-native"

import { Button } from "@/components/Button"
import { ClaimOfflineDataModal } from "@/components/ClaimOfflineDataModal"
import { GlassCard } from "@/components/GlassCard"
import { RadialGlow } from "@/components/RadialGlow"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { googleOauth, isValidGoogleClientId } from "@/config/oauth"
import { goToHome } from "@/navigation/navigationActions"
import type { AuthStackScreenProps } from "@/navigators/navigationTypes"
import {
  claimPendingOfflineData,
  finalizeRemoteLogin,
  keepRemoteDataSeparate,
  prepareRemoteLogin,
} from "@/services/auth/completeRemoteLogin"
import { refreshAuthSession } from "@/services/auth/session"
import { GUEST_SCOPE_KEY } from "@/services/session/scope"
import { logScopeAction, withScopeTransitionLock } from "@/services/session/scopeTransition"
import { setOfflineMode } from "@/services/storage/session"
import {
  deriveUserIdFromEmail,
  generateUuidV4,
  setCurrentUserId,
  setSessionMode,
} from "@/services/sync/identity"
import { syncController } from "@/services/sync/SyncController"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { useAuthViewModel } from "./useAuthViewModel"

const ROBOT_ANIM = require("@assets/animations/robot.json")
const logo = require("@assets/images/logo.png")

const SHOW_SOCIAL_AUTH_UI = false

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
  const { bootstrapAfterLogin } = useWorkspaceStore()

  const googleConfig = {
    androidClientId: googleOauth.androidClientId,
    iosClientId: googleOauth.iosClientId,
    webClientId: googleOauth.webClientId,
  }
  const isGoogleConfigured = isValidGoogleClientId(
    Platform.OS === "ios" ? googleConfig.iosClientId : googleConfig.androidClientId,
  )
  const showGoogleButton = SHOW_SOCIAL_AUTH_UI && isGoogleConfigured
  const showAppleButton = SHOW_SOCIAL_AUTH_UI && Platform.OS === "ios"
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleConfig)

  // UI: pick a subtle accent based on your theme if it exists
  const accent = useMemo(() => {
    return theme.colors.palette.primary600 ?? "#7C5CFF"
  }, [theme])

  const finalizeRemoteAuth = useCallback(
    async (userId: string) => {
      await finalizeRemoteLogin(userId, "login_remote")
      await bootstrapAfterLogin()
      goToHome()
    },
    [bootstrapAfterLogin],
  )

  const completeRemoteAuth = useCallback(
    async (accessToken: string, refreshToken: string) => {
      const result = await prepareRemoteLogin(accessToken, refreshToken)
      if (!result.userId) {
        setError("Unable to read user session. Please try again.")
        return
      }
      if (result.needsClaim) {
        setPendingRemoteUserId(result.userId)
        setShowClaimModal(true)
        return
      }
      await finalizeRemoteAuth(result.userId)
    },
    [finalizeRemoteAuth],
  )

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
        await completeRemoteAuth(auth.accessToken, auth.refreshToken)
      } catch {
        setError("Google login failed. Please try again.")
      }
    }
    void handleGoogleResponse()
  }, [completeRemoteAuth, loginWithGoogle, response])

  const handleLogin = async () => {
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError("Email and password are required.")
      return
    }
    try {
      const auth = await loginWithEmail(normalizedEmail, password)
      await completeRemoteAuth(auth.accessToken, auth.refreshToken)
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
        setSignupMessage(
          result.previewToken
            ? "Account created. Continue to verification."
            : "Account created. Check your email to verify your account.",
        )
        if (result.previewToken) {
          navigation.navigate("VerifyEmail", { email: normalizedEmail, token: result.previewToken })
        }
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
        e?.response?.data?.error ?? `Sign up failed (${e?.response?.status ?? "no status"}).`,
      )
    }
  }

  const handleResendVerification = async () => {
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError("Enter your email to resend verification.")
      return
    }
    const result = await resendVerificationEmail(normalizedEmail)
    setSignupMessage(
      result.previewToken
        ? "Verification details refreshed."
        : "Verification email resent. Check your inbox.",
    )
    if (result.previewToken) {
      navigation.navigate("VerifyEmail", { email: normalizedEmail, token: result.previewToken })
    }
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
      await completeRemoteAuth(auth.accessToken, auth.refreshToken)
    } catch (err: any) {
      if (err?.code === "ERR_CANCELED") return
      setError("Apple login failed. Please try again.")
    }
  }

  const handleContinueOffline = async () => {
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    const userId = normalizedEmail
      ? await deriveUserIdFromEmail(normalizedEmail)
      : await generateUuidV4()
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

  const handleClaimOfflineData = async () => {
    if (!pendingRemoteUserId) return
    await claimPendingOfflineData(pendingRemoteUserId, "claim_offline_data")
    setShowClaimModal(false)
    await bootstrapAfterLogin()
    goToHome()
    void syncController.triggerSync("manual")
  }

  const handleKeepSeparate = async () => {
    if (!pendingRemoteUserId) return
    await keepRemoteDataSeparate(pendingRemoteUserId, "discard_offline_data")
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
      <View style={themed($hero)}>
        <RadialGlow
          width={190}
          height={190}
          color={accent}
          opacity={0.9}
          style={themed($heroOrbLeft)}
        />

        <RadialGlow
          width={220}
          height={220}
          color={theme.colors.gradientEnd}
          opacity={0.6}
          style={themed($heroOrbRight)}
        />
        <View style={themed($heroInner)}>
          <View style={themed($heroBadge)}>
            <Image source={logo} style={themed($heroBadgeLogo)} resizeMode="contain" />
          </View>
          <View style={themed($heroRow)}>
            <View style={themed($robotWrap)}>
              <LottieView source={ROBOT_ANIM} autoPlay loop style={themed($robot)} />
            </View>
            <View style={themed($heroTextCol)}>
              <Text preset="display" text="Move work forward." style={themed($heroTitle)} />
              <Text
                preset="formHelper"
                text="A premium offline-first execution workspace with reliable sync when you need it."
                style={themed($heroBody)}
              />
            </View>
          </View>
        </View>
      </View>

      <GlassCard>
        <View style={themed($cardHeader)}>
          <Text preset="sectionTitle" text="Welcome to Velo" />
          <Text preset="formHelper" text="Sign in with your account or keep working locally." />
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

        {error || signupMessage ? (
          <View style={themed($messageWrap)}>
            {error ? <Text preset="formHelper" text={error} style={themed($errorText)} /> : null}
            {signupMessage ? (
              <Text preset="formHelper" text={signupMessage} style={themed($successText)} />
            ) : null}
          </View>
        ) : null}

        <View style={themed($buttonStack)}>
          <Button text="Sign in" preset="default" onPress={handleLogin} />
          <Button text="Create account" preset="filled" onPress={handleSignup} />
        </View>

        {signupMessage ? (
          <View style={themed($buttonStackTight)}>
            <Button
              text="Resend verification email"
              preset="glass"
              onPress={handleResendVerification}
            />
            <Button
              text="Enter verification token"
              preset="glass"
              onPress={() =>
                navigation.navigate("VerifyEmail", { email: email.trim().toLowerCase() })
              }
            />
          </View>
        ) : null}

        <View style={themed($buttonStackTight)}>
          <Button
            text="Forgot password?"
            preset="glass"
            onPress={() => navigation.navigate("PasswordResetRequest")}
          />
          <Button text="Continue offline" preset="reversed" onPress={handleContinueOffline} />
        </View>

        {SHOW_SOCIAL_AUTH_UI ? (
          <>
            <View style={themed($divider)} />
            <View style={themed($buttonStackTight)}>
              {showGoogleButton ? (
                <Button text="Continue with Google" preset="filled" onPress={handleGoogleLogin} />
              ) : null}
              {showAppleButton ? (
                <Button text="Continue with Apple" preset="filled" onPress={handleAppleLogin} />
              ) : null}
            </View>
          </>
        ) : null}
      </GlassCard>

      <GlassCard>
        <Text preset="overline" text="Offline ready" />
        <Text preset="formHelper" text={offlineNotice} style={themed($noticeText)} />
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
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.screenVertical,
  paddingBottom: spacing.xxxl,
  gap: spacing.sectionGap,
})

const $hero: ThemedStyle<ViewStyle> = ({ colors, radius, elevation, spacing }) => ({
  position: "relative",
  overflow: "hidden",
  borderRadius: radius.xl,
  backgroundColor: colors.surfaceElevated,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
  padding: spacing.xl,
  ...elevation.floating,
})

const $heroOrbLeft: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  top: -70,
  left: -40,
  width: 190,
  height: 190,
})

const $heroOrbRight: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  right: -48,
  bottom: -76,
  width: 220,
  height: 220,
})

const $heroInner: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.lg,
})

const $heroBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignSelf: "flex-start",
  borderRadius: 99,
  backgroundColor: colors.surfaceGlass,
  borderWidth: 1,
  borderColor: colors.borderSubtle,
})

const $heroBadgeLogo: ThemedStyle<ViewStyle> = () => ({
  width: 55,
  height: 55,
})

const $heroRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.lg,
})

const $robotWrap: ThemedStyle<ViewStyle> = ({ colors, radius }) => ({
  width: 96,
  height: 96,
  borderRadius: radius.large,
  overflow: "hidden",
  backgroundColor: colors.surfaceGlass,
})

const $robot: ThemedStyle<ViewStyle> = () => ({
  width: 96,
  height: 96,
})

const $heroTextCol: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xs,
})

const $heroTitle: ThemedStyle<TextStyle> = () => ({
  maxWidth: 260,
})

const $heroBody: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
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
  paddingVertical: spacing.sm,
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
  opacity: 1,
  marginTop: spacing.md,
  marginBottom: spacing.md,
  backgroundColor: "rgba(255,255,255,0.12)",
})

const $noticeText: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.danger,
})

const $successText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.success,
})
