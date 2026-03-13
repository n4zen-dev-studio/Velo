import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { SyncDebugScreen } from "@/devtools/SyncDebugScreen"
import type { SyncStackParamList } from "@/navigators/navigationTypes"
import { ConflictListScreen } from "@/screens/ConflictListScreen"
import { ConflictResolutionScreen } from "@/screens/ConflictResolution"
import { useAppTheme } from "@/theme/context"

const Stack = createNativeStackNavigator<SyncStackParamList>()

export function SyncStack() {
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Stack.Navigator
      initialRouteName="SyncConsole"
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="SyncConsole" component={SyncDebugScreen} />
      <Stack.Screen name="ConflictList" component={ConflictListScreen} />
      <Stack.Screen name="ConflictResolution" component={ConflictResolutionScreen} />
    </Stack.Navigator>
  )
}
