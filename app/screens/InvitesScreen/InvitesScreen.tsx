import { useCallback, useEffect, useState } from "react"
import { View, ViewStyle, TextStyle } from "react-native"
import { useNavigation } from "@react-navigation/native"

import { Button } from "@/components/Button"
import { GlassCard } from "@/components/GlassCard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { createHttpClient } from "@/services/api/httpClient"
import { acceptInvite, listMyInvites, type InviteSummary } from "@/services/api/invitesApi"
import { BASE_URL } from "@/config/api"
import { syncController } from "@/services/sync/SyncController"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import type { HomeStackScreenProps } from "@/navigators/navigationTypes"

export function InvitesScreen() {
  const { themed } = useAppTheme()
  const navigation = useNavigation<HomeStackScreenProps<"Invites">["navigation"]>()
  const { setActiveWorkspaceId } = useWorkspaceStore()
  const [invites, setInvites] = useState<InviteSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadInvites = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const client = createHttpClient(BASE_URL)
      const data = await listMyInvites(client)
      setInvites(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load invites"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  const handleAccept = useCallback(
    async (token: string, workspaceId: string) => {
      try {
        const client = createHttpClient(BASE_URL)
        await acceptInvite(client, token)
        await syncController.triggerSync("manual")
        await setActiveWorkspaceId(workspaceId)
        void loadInvites()
        navigation.navigate("Home")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to accept invite"
        setError(message)
      }
    },
    [loadInvites, navigation, setActiveWorkspaceId],
  )

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screen)}>
      <View style={themed($header)}>
        <Text preset="heading" text="Invites" />
        <Text preset="formHelper" text="Pending workspace invitations" />
      </View>

      {error ? (
        <GlassCard>
          <Text preset="formHelper" text={error} style={themed($errorText)} />
        </GlassCard>
      ) : null}

      <GlassCard>
        <View style={themed($stack)}>
          {isLoading ? (
            <Text preset="formHelper" text="Loading invites..." />
          ) : invites.length === 0 ? (
            <Text preset="formHelper" text="No pending invites." />
          ) : (
            invites.map((invite) => (
              <View key={invite.id} style={themed($inviteRow)}>
                <View style={themed($inviteInfo)}>
                  <Text preset="formLabel" text={invite.workspace.label} />
                  <Text preset="formHelper" text={`Role: ${invite.role}`} />
                  <Text preset="formHelper" text={`Invited by ${invite.invitedBy.email}`} />
                </View>
                <Button
                  text="Accept"
                  preset="glass"
                  onPress={() => handleAccept(invite.token, invite.workspace.id)}
                />
              </View>
            ))
          )}
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

const $stack: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
})

const $inviteRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
})

const $inviteInfo: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.xxs,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.error,
})
