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

import { useAuthViewModel } from "./useAuthViewModel"

export function AuthScreen() {
  const { themed } = useAppTheme()
  const { offlineNotice } = useAuthViewModel()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigation = useNavigation<AppStackScreenProps<"Auth">["navigation"]>()

  const handleContinue = async () => {
    const userId = email ? await deriveUserIdFromEmail(email.trim().toLowerCase()) : await generateUuidV4()
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
        <View style={themed($buttonRow)}>
          <Button text="Login" preset="default" onPress={handleContinue} />
          <Button text="Continue Offline" preset="reversed" onPress={handleContinue} />
        </View>
      </GlassCard>

      <GlassCard>
        <Text preset="formHelper" text={offlineNotice} />
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

const $spacer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  height: spacing.sm,
})

const $buttonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginTop: spacing.md,
})
