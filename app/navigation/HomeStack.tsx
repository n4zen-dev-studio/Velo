import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { HomeScreen } from "@/screens/HomeScreen"
import { TaskEditorScreen } from "@/screens/TaskEditorScreen"
import { TaskDetailScreen } from "@/screens/TaskDetailScreen"
import { ConflictListScreen } from "@/screens/ConflictListScreen"
import { ConflictResolutionScreen } from "@/screens/ConflictResolution"
import { useAppTheme } from "@/theme/context"
import type { HomeStackParamList } from "@/navigators/navigationTypes"

const Stack = createNativeStackNavigator<HomeStackParamList>()

export function HomeStack() {
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="TaskEditor" component={TaskEditorScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="ConflictList" component={ConflictListScreen} />
      <Stack.Screen name="ConflictResolution" component={ConflictResolutionScreen} />
    </Stack.Navigator>
  )
}
