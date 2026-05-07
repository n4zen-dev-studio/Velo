import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"

import { SettingsScreen } from "@/screens/SettingsScreen"
import { SyncDebugScreen } from "@/devtools/SyncDebugScreen"
import { HomeStack } from "@/navigation/HomeStack"
import { useAppTheme } from "@/theme/context"
import type { MainTabParamList } from "@/navigators/navigationTypes"

const Tab = createBottomTabNavigator<MainTabParamList>()

export function MainTabs() {
  const {
    theme: { colors },
  } = useAppTheme()

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} />
      <Tab.Screen name="DebugTab" component={SyncDebugScreen} />
    </Tab.Navigator>
  )
}
