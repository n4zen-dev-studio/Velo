import { createNativeStackNavigator } from "@react-navigation/native-stack"

import type { ProjectsStackParamList } from "@/navigators/navigationTypes"
import { ProjectDetailScreen } from "@/screens/ProjectDetailScreen"
import { ProjectsEntryScreen } from "@/screens/ProjectsEntryScreen"
import { ProjectsScreen } from "@/screens/ProjectsScreen"
import { TaskDetailScreen } from "@/screens/TaskDetailScreen"
import { TaskEditorScreen } from "@/screens/TaskEditorScreen"
import { useAppTheme } from "@/theme/context"

const Stack = createNativeStackNavigator<ProjectsStackParamList>()

export function ProjectsStack() {
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Stack.Navigator
      initialRouteName="ProjectsEntry"
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ProjectsEntry" component={ProjectsEntryScreen} />
      <Stack.Screen name="ProjectsHome" component={ProjectsScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="TaskEditor" component={TaskEditorScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
    </Stack.Navigator>
  )
}
