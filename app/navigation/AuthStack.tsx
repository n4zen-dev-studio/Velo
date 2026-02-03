import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { AuthScreen } from "@/screens/AuthScreen"
import { VerifyEmailScreen } from "@/screens/VerifyEmailScreen"
import { PasswordResetRequestScreen } from "@/screens/PasswordResetRequestScreen"
import { PasswordResetConfirmScreen } from "@/screens/PasswordResetConfirmScreen"
import { useAppTheme } from "@/theme/context"
import type { AuthStackParamList } from "@/navigators/navigationTypes"

const Stack = createNativeStackNavigator<AuthStackParamList>()

export function AuthStack() {
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Stack.Navigator
      initialRouteName="Auth"
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="PasswordResetRequest" component={PasswordResetRequestScreen} />
      <Stack.Screen name="PasswordResetConfirm" component={PasswordResetConfirmScreen} />
    </Stack.Navigator>
  )
}
