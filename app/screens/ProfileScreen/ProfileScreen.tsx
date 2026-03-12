import { useEffect, useState } from "react"
import { Image, View, ViewStyle, TextStyle, ImageStyle, TouchableOpacity } from "react-native"
import { useNavigation } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { getUserById, upsertUser } from "@/services/db/repositories/usersRepository"
import { syncController } from "@/services/sync/SyncController"
import { getCurrentUserId } from "@/services/sync/identity"
import type { User } from "@/services/db/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { userScopeKey } from "@/services/session/scope"
import { Ionicons } from "@expo/vector-icons"

const fallbackAvatar = require("@assets/images/avatar_placeholder.jpg")

export function ProfileScreen() {
  const { themed, theme } = useAppTheme()
  const navigation = useNavigation<HomeStackScreenProps<"Profile">["navigation"]>()
  const [userId, setUserId] = useState<string | null>(null)
  const [userRow, setUserRow] = useState<User | null>(null)
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const currentUserId = await getCurrentUserId()
      if (!mounted) return
      setUserId(currentUserId)
      if (!currentUserId) return
      const row = await getUserById(currentUserId)
      if (!mounted) return
      if (row) {
        setUserRow(row as User)
        setUsername(row.username ?? "")
        setDisplayName(row.displayName ?? "")
        setAvatarUrl(row.avatarUrl ?? "")
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const validateUsername = (value: string) => {
    if (!value) return null
    if (value.length < 3 || value.length > 20) return "Username must be 3-20 characters."
    if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
      return "Username can only use letters, numbers, dots, underscores, and dashes."
    }
    return null
  }

  const handlePickImage = async () => {
    setError(null)
    try {
      const picker = await import("expo-image-picker")
      const result = await picker.launchImageLibraryAsync({
        mediaTypes: picker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      })
      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatarUrl(result.assets[0].uri)
      }
    } catch {
      setError("Image picker not available on this device.")
    }
  }

  const handleSave = async () => {
    if (!userId) {
      setError("No active user session.")
      return
    }
    const trimmedUsername = username.trim()
    const validation = validateUsername(trimmedUsername)
    if (validation) {
      setError(validation)
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      const next: User = {
        id: userId,
        email: userRow?.email ?? null,
        username: trimmedUsername || null,
        displayName: displayName.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        createdAt: userRow?.createdAt ?? now,
        updatedAt: now,
        revision: `local-${Date.now()}`,
        deletedAt: userRow?.deletedAt ?? null,
        scopeKey: userScopeKey(userId),
      }
      await upsertUser(next)
      setUserRow(next)
      await syncController.triggerSync("manual")
      navigation.goBack()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile."
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($screen)}
    >
      <View style={themed($header)}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons
              name={"arrow-back"}
              size={25}
              color={theme.colors.text}
              style={{ padding: 5 }}
            />
          </TouchableOpacity>

          <Text preset="heading" text="Profile" />
        </View>
        <Text
          preset="formHelper"
          text="Update your Velo identity across projects."
          style={themed($muted)}
        />
      </View>

      <GlassCard>
        <View style={themed($avatarRow)}>
          <Image
            source={avatarUrl ? { uri: avatarUrl } : fallbackAvatar}
            style={themed($avatarImage)}
          />
          <View style={themed($avatarActions)}>
            <Button text="Change photo" preset="filled" onPress={handlePickImage} />
          </View>
        </View>

        <Text preset="formLabel" text="Display name" />
        <TextField
          value={displayName}
          onChangeText={(value) => setDisplayName(value)}
          placeholder="Optional display name"
        />

        <Text preset="formLabel" text="Username" />
        <TextField
          value={username}
          onChangeText={(value) => {
            setUsername(value)
            if (error) setError(null)
          }}
          placeholder="your_handle"
          autoCapitalize="none"
        />

        <Text preset="formLabel" text="Avatar URL" />
        <TextField
          value={avatarUrl}
          onChangeText={(value) => setAvatarUrl(value)}
          placeholder="https://..."
          autoCapitalize="none"
        />

        {error ? <Text preset="formHelper" text={error} style={themed($errorText)} /> : null}

        <View style={themed($actionsRow)}>
          <Button text="Cancel" preset="glass" onPress={() => navigation.goBack()} />
          <Button text={isSaving ? "Saving..." : "Save"} preset="default" onPress={handleSave} />
        </View>
      </GlassCard>
    </Screen>
  )
}

const $screen: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.screenHorizontal,
  paddingTop: spacing.screenVertical,
  gap: spacing.sectionGap,
})

const $header: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
})

const $avatarRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.md,
  marginBottom: spacing.md,
})

const $avatarImage: ThemedStyle<ImageStyle> = ({ spacing, colors }) => ({
  width: 84,
  height: 84,
  borderRadius: 42,
  marginRight: spacing.sm,
  borderWidth: 3,
  borderColor: colors.surfaceElevated,
})

const $avatarActions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xs,
})

const $actionsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.sm,
  marginTop: spacing.md,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})

const $muted: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textMuted,
})
