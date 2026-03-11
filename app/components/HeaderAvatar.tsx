import { useEffect, useState } from "react"
import { Image, Pressable, ViewStyle, ImageStyle } from "react-native"

import { useSyncStatus } from "@/services/sync/syncStore"
import { getCurrentUserId } from "@/services/sync/identity"
import { resolveUserMeta } from "@/utils/userLabel"
import { useAppTheme } from "@/theme/context"

const fallbackAvatar = require("@assets/images/avatar_placeholder.jpg")

type HeaderAvatarProps = {
  onPress?: () => void
  size?: number
}

export function HeaderAvatar({ onPress, size = 36 }: HeaderAvatarProps) {
  const { theme } = useAppTheme()
  const syncStatus = useSyncStatus()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const userId = await getCurrentUserId()
      const meta = await resolveUserMeta(userId)
      if (!mounted) return
      setAvatarUrl(meta.avatarUrl ?? null)
    })()
    return () => {
      mounted = false
    }
  }, [syncStatus.lastSyncedAt])

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [$avatarButton(size), pressed && { opacity: 0.8 }]}
    >
      <Image
        source={avatarUrl ? { uri: avatarUrl } : fallbackAvatar}
        style={$avatarImage(size, theme.colors.background)}
      />
    </Pressable>
  )
}

const $avatarButton = (size: number): ViewStyle => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  overflow: "hidden",
})

const $avatarImage = (size: number, backgroundColor: string): ImageStyle => ({
  width: size,
  height: size,
  borderRadius: size / 2,
  borderWidth: 2,
  borderColor: backgroundColor,
})
