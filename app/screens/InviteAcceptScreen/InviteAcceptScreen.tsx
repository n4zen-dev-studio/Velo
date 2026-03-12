import { useCallback, useEffect, useState } from "react"
import { View, ViewStyle, TextStyle, TouchableOpacity } from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { createHttpClient } from "@/services/api/httpClient"
import { acceptInvite, getInvite } from "@/services/api/invitesApi"
import { BASE_URL } from "@/config/api"
import { syncController } from "@/services/sync/SyncController"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { upsertWorkspaceFromSync } from "@/services/db/repositories/workspacesRepository"
import { ensureDefaultStatusesForWorkspace } from "@/services/db/repositories/statusesRepository"
import { upsertWorkspaceMemberFromSync } from "@/services/db/repositories/workspaceMembersRepository"
import { getActiveScopeKey } from "@/services/session/scope"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"
import { Ionicons } from "@expo/vector-icons"

interface InviteDetails {
  workspace: { id: string; label: string }
  email: string
  status: string
  expiresAt: string
}

export function InviteAcceptScreen() {
  const { themed, theme } = useAppTheme()
  const navigation = useNavigation<HomeStackScreenProps<"InviteAccept">["navigation"]>()
  const route = useRoute<HomeStackScreenProps<"InviteAccept">["route"]>()
  const { token } = route.params ?? {}
  const { refreshWorkspaces } = useWorkspaceStore()
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)

  const loadInvite = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const client = createHttpClient(BASE_URL)
      const data = await getInvite(client, token)
      setInvite(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load invite"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadInvite()
  }, [loadInvite])

  const handleAccept = useCallback(async () => {
    if (!token || !invite) return
    setIsAccepting(true)
    setError(null)
    try {
      const client = createHttpClient(BASE_URL)
      const response = await acceptInvite(client, token)
      const scopeKey = await getActiveScopeKey()
      if (response.membership) {
        await upsertWorkspaceMemberFromSync({
          id: response.membership.id,
          workspaceId: response.membership.workspaceId,
          userId: response.membership.userId,
          role: response.membership.role,
          createdAt: response.membership.createdAt,
          updatedAt: response.membership.updatedAt,
          revision: response.membership.revision,
          deletedAt: response.membership.deletedAt,
          scopeKey,
        })
      }
      await upsertWorkspaceFromSync(
        {
          id: response.workspace.id,
          label: response.workspace.label,
          kind: response.workspace.kind ?? "custom",
        },
        scopeKey,
      )
      await ensureDefaultStatusesForWorkspace(response.workspace.id, scopeKey)
      await refreshWorkspaces()
      await syncController.triggerSync("manual")
      navigation.navigate("Home")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to accept invite"
      setError(message)
    } finally {
      setIsAccepting(false)
    }
  }, [invite, navigation, setActiveWorkspaceId, token])

  return (
    <Screen preset="scroll" safeAreaEdges={['top', 'bottom']} contentContainerStyle={themed($screen)}>
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

        <Text preset="heading" text="Project invite" />
        </View>
        <Text preset="formHelper" text="Accept your invitation to collaborate" />
      </View>

      <GlassCard>
        {isLoading ? (
          <Text preset="formHelper" text="Loading invite..." />
        ) : error ? (
          <Text preset="formHelper" text={error} style={themed($errorText)} />
        ) : invite ? (
          <View style={themed($stack)}>
            <Text preset="subheading" text={invite.workspace.label} />
            <Text preset="formHelper" text={`Invited email: ${invite.email}`} />
            <Text preset="formHelper" text={`Status: ${invite.status}`} />
            <Button
              text={isAccepting ? "Accepting..." : "Accept invite"}
              preset="glass"
              onPress={handleAccept}
              disabled={isAccepting || invite.status !== "PENDING"}
            />
          </View>
        ) : (
          <Text preset="formHelper" text="Invite not found." />
        )}
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

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})
