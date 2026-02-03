// app/navigators/MainTabs.tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"

import { SettingsScreen } from "@/screens/SettingsScreen"
import { SyncDebugScreen } from "@/devtools/SyncDebugScreen"
import { HomeStack } from "@/navigation/HomeStack"
import type { MainTabParamList } from "@/navigators/navigationTypes"

import { GlassTabBar } from "@/components/navigation/GlassTabBar"

const Tab = createBottomTabNavigator<MainTabParamList>()

export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        // Important: hide the default bar background + border
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: "Home" }} />
      <Tab.Screen name="DebugTab" component={SyncDebugScreen} options={{ title: "Debug" }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: "Settings" }} />
    </Tab.Navigator>
  )
}
