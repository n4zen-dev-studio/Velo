import { useEffect, useState } from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { AuthStack } from "@/navigation/AuthStack"
import { MainTabs } from "@/navigation/MainTabs"
import { hasSession, isOfflineMode } from "@/services/storage/session"
import { useAppTheme } from "@/theme/context"
import type { AuthGateParamList } from "@/navigators/navigationTypes"
import { useAuthSession } from "@/services/auth/session"
import { useWorkspaceStore } from "@/stores/workspaceStore"

const Stack = createNativeStackNavigator<AuthGateParamList>()

export function AuthGate() {
  const {
    theme: { colors },
  } = useAppTheme()
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const authSession = useAuthSession()
  const { bootstrapAfterLogin, didBootstrapSync } = useWorkspaceStore()

  useEffect(() => {
    let mounted = true
    Promise.all([hasSession(), isOfflineMode()])
      .then(([sessionActive, offlineAllowed]) => {
        if (mounted) setIsAuthenticated(sessionActive || offlineAllowed)
      })
      .finally(() => {
        if (mounted) setIsReady(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!authSession.isAuthenticated || didBootstrapSync) return
    void bootstrapAfterLogin()
  }, [authSession.isAuthenticated, bootstrapAfterLogin, didBootstrapSync])

  if (!isReady) return null

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? "MainTabs" : "AuthStack"}
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="AuthStack" component={AuthStack} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
    </Stack.Navigator>
  )
}
