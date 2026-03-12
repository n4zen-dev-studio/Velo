import { createNativeStackNavigator } from "@react-navigation/native-stack"

import { ProjectDetailScreen } from "@/screens/ProjectDetailScreen"
import { ProjectsScreen } from "@/screens/ProjectsScreen"
import { TaskEditorScreen } from "@/screens/TaskEditorScreen"
import { TaskDetailScreen } from "@/screens/TaskDetailScreen"
import { useAppTheme } from "@/theme/context"
import type { ProjectsStackParamList } from "@/navigators/navigationTypes"

const Stack = createNativeStackNavigator<ProjectsStackParamList>()

export function ProjectsStack() {
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Stack.Navigator
      initialRouteName="ProjectsHome"
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ProjectsHome" component={ProjectsScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="TaskEditor" component={TaskEditorScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
    </Stack.Navigator>
  )
}
