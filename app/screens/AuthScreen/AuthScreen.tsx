import { useState } from "react"
import { View, ViewStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import {
  deriveUserIdFromEmail,
  generateUuidV4,
  setCurrentUserId,
  setSessionMode,
} from "@/services/sync/identity"
import { setTokens } from "@/services/api/tokenStore"

import { useAuthViewModel } from "./useAuthViewModel"

export function AuthScreen() {
  const { themed } = useAppTheme()
  const { offlineNotice, loginWithEmail, signupWithEmail } = useAuthViewModel()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const navigation = useNavigation<AppStackScreenProps<"Auth">["navigation"]>()

  const handleLogin = async () => {
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError("Email and password are required.")
      return
    }
    try {
      const auth = await loginWithEmail(normalizedEmail, password)
      await setTokens(auth.accessToken, auth.refreshToken)
      const userId = parseUserIdFromJwt(auth.accessToken)
      if (!userId) {
        setError("Unable to read user session. Please try again.")
        return
      }
      await setCurrentUserId(userId)
      await setSessionMode("remote")
      navigation.reset({ index: 0, routes: [{ name: "Home" }] })
    } catch (err: any) {
      if (err?.type === "EMAIL_NOT_VERIFIED") {
        navigation.navigate("VerifyEmail", { email: normalizedEmail, password })
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
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError("Email and password are required.")
      return
    }
    try {
      const result = await signupWithEmail(normalizedEmail, password)
      if (result.requiresEmailVerification) {
        navigation.navigate("VerifyEmail", { email: normalizedEmail, password })
      }
    } catch {
      setError("Sign up failed. Please try again.")
    }
  }

  const handleContinueOffline = async () => {
    setError(null)
    const normalizedEmail = email.trim().toLowerCase()
    const userId = normalizedEmail ? await deriveUserIdFromEmail(normalizedEmail) : await generateUuidV4()
    await setCurrentUserId(userId)
    await setSessionMode("local")
    navigation.reset({ index: 0, routes: [{ name: "Home" }] })
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
        <View style={themed($buttonRow)}>
          <Button text="Login" preset="default" onPress={handleLogin} />
          <Button text="Sign up" preset="reversed" onPress={handleSignup} />
        </View>
        <View style={themed($buttonRow)}>
          <Button text="Continue Offline" preset="reversed" onPress={handleContinueOffline} />
        </View>
      </GlassCard>

      <GlassCard>
        <Text preset="formHelper" text={offlineNotice} />
      </GlassCard>
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
