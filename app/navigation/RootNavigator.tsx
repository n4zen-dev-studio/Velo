import { useEffect, useState } from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { AuthGate } from "@/navigation/AuthGate"
import { OnboardingStack } from "@/navigation/OnboardingStack"
import { hasSeenOnboarding } from "@/services/storage/firstLaunch"
import { useAppTheme } from "@/theme/context"
import type { RootStackParamList } from "@/navigators/navigationTypes"

const Stack = createNativeStackNavigator<RootStackParamList>()

export function RootNavigator() {
  const {
    theme: { colors },
  } = useAppTheme()
  const [isReady, setIsReady] = useState(false)
  const [seenOnboarding, setSeenOnboarding] = useState(false)

  useEffect(() => {
    let mounted = true
    hasSeenOnboarding()
      .then((value) => {
        if (mounted) setSeenOnboarding(value)
      })
      .finally(() => {
        if (mounted) setIsReady(true)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (!isReady) return null

  return (
    <Stack.Navigator
      initialRouteName={seenOnboarding ? "AuthGate" : "Onboarding"}
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingStack} />
      <Stack.Screen name="AuthGate" component={AuthGate} />
    </Stack.Navigator>
  )
}
