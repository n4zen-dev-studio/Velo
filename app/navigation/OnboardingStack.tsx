import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { OnboardingScreen } from "@/screens/OnboardingScreen"
import { useAppTheme } from "@/theme/context"
import type { OnboardingStackParamList } from "@/navigators/navigationTypes"

const Stack = createNativeStackNavigator<OnboardingStackParamList>()

export function OnboardingStack() {
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { flex: 1, backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  )
}
