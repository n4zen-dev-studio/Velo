// app/navigators/MainTabs.tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"

import { GlassTabBar } from "@/components/navigation/GlassTabBar"
import { SyncDebugScreen } from "@/devtools/SyncDebugScreen"
import { HomeStack } from "@/navigation/HomeStack"
import { ProjectsStack } from "@/navigation/ProjectsStack"
import type { MainTabParamList } from "@/navigators/navigationTypes"
import { SettingsScreen } from "@/screens/SettingsScreen"

const Tab = createBottomTabNavigator<MainTabParamList>()

export function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="DashboardTab"
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
      <Tab.Screen name="DashboardTab" component={HomeStack} options={{ title: "Dashboard" }} />
      <Tab.Screen
        name="ProjectsTab"
        component={ProjectsStack}
        options={{ title: "Projects" }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate("ProjectsTab" as never, { screen: "ProjectsEntry" } as never)
          },
        })}
      />
      <Tab.Screen name="DebugTab" component={SyncDebugScreen} options={{ title: "Debug" }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: "Settings" }} />
    </Tab.Navigator>
  )
}
