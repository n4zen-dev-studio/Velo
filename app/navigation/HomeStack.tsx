import { createNativeStackNavigator } from "@react-navigation/native-stack"

import type { HomeStackParamList } from "@/navigators/navigationTypes"
import { HomeScreen } from "@/screens/HomeScreen"
import { InviteAcceptScreen } from "@/screens/InviteAcceptScreen"
import { InvitesScreen } from "@/screens/InvitesScreen"
import { ProfileScreen } from "@/screens/ProfileScreen"
import { TaskDetailScreen } from "@/screens/TaskDetailScreen"
import { TaskEditorScreen } from "@/screens/TaskEditorScreen"
import { useAppTheme } from "@/theme/context"

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
      <Stack.Screen name="Invites" component={InvitesScreen} />
      <Stack.Screen name="InviteAccept" component={InviteAcceptScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  )
}
