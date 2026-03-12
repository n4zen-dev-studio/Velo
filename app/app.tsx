/* eslint-disable import/first */
/**
 * Welcome to the main entry point of the app. In this file, we'll
 * be kicking off our app.
 *
 * Most of this file is boilerplate and you shouldn't need to modify
 * it very often. But take some time to look through and understand
 * what is going on here.
 *
 * The app navigation resides in ./app/navigators, so head over there
 * if you're interested in adding screens and navigators.
 */
if (__DEV__) {
  // Load Reactotron in development only.
  // Note that you must be using metro's `inlineRequires` for this to work.
  // If you turn it off in metro.config.js, you'll have to manually import it.
  require("./devtools/ReactotronConfig.ts")
}
import "./utils/gestureHandler"

import { useEffect, useState } from "react"
import { useFonts } from "expo-font"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"

import { initI18n } from "./i18n"
import { AppNavigator } from "./navigators/AppNavigator"
import { useNavigationPersistence } from "./navigators/navigationUtilities"
import { ThemeProvider } from "./theme/context"
import { WorkspaceProvider } from "./stores/workspaceStore"
import { customFontsToLoad } from "./theme/typography"
import { loadDateFnsLocale } from "./utils/formatDate"
import { initializeDatabase } from "./services/db"
import * as storage from "./utils/storage"
import { syncController } from "./services/sync/SyncController"
import { registerBackgroundSync } from "./services/sync/backgroundSync"
import { BASE_URL } from "./config/api"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { refreshAuthSession } from "./services/auth/session"

WebBrowser.maybeCompleteAuthSession()

export const NAVIGATION_PERSISTENCE_KEY = "NAVIGATION_STATE"

// Web linking configuration
const prefix = Linking.createURL("/")
const config = {
  screens: {
    Onboarding: "onboarding",
    AuthGate: {
      screens: {
        AuthStack: {
          screens: {
            Auth: "",
            VerifyEmail: "verify-email",
            PasswordResetRequest: "password-reset",
            PasswordResetConfirm: "password-reset/confirm",
          },
        },
        MainTabs: {
          screens: {
            DashboardTab: {
              screens: {
                Home: "home",
                TaskEditor: "task-editor/:taskId?",
                TaskDetail: "task/:taskId",
                ConflictList: "conflicts",
                ConflictResolution: "conflicts/:conflictId",
                InviteAccept: "invite/:token?",
                Invites: "invites",
                Profile: "profile",
              },
            },
            ProjectsTab: {
              screens: {
                ProjectsHome: "projects",
                ProjectDetail: "projects/:workspaceId",
                TaskEditor: "projects/task-editor/:taskId?",
                TaskDetail: "projects/task/:taskId",
              },
            },
            SettingsTab: "settings",
            DebugTab: "sync-debug",
          },
        },
      },
    },
  },
}

/**
 * This is the root component of our app.
 * @param {AppProps} props - The props for the `App` component.
 * @returns {JSX.Element} The rendered `App` component.
 */
export function App() {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[API] BASE_URL =", BASE_URL)
  }
  const {
    initialNavigationState,
    onNavigationStateChange,
    isRestored: isNavigationStateRestored,
  } = useNavigationPersistence(storage, NAVIGATION_PERSISTENCE_KEY)

  const [areFontsLoaded, fontLoadError] = useFonts(customFontsToLoad)
  const [isI18nInitialized, setIsI18nInitialized] = useState(false)

  useEffect(() => {
    initI18n()
      .then(() => setIsI18nInitialized(true))
      .then(() => loadDateFnsLocale())
  }, [])

  useEffect(() => {
    if (typeof initializeDatabase !== "function") {
      console.error("initializeDatabase export missing - check services/db/index.ts")
      return
    }
    initializeDatabase().catch((error) => console.error("Failed to init DB", error))
    refreshAuthSession().catch((error) => console.warn("Failed to load auth session", error))
  }, [])

  useEffect(() => {
    syncController.initialize()
    registerBackgroundSync().catch((error) =>
      console.warn("Background sync registration failed", error),
    )
    return () => syncController.dispose()
  }, [])

  // Before we show the app, we have to wait for our state to be ready.
  // In the meantime, don't render anything. This will be the background
  // color set in native by rootView's background color.
  // In iOS: application:didFinishLaunchingWithOptions:
  // In Android: https://stackoverflow.com/a/45838109/204044
  // You can replace with your own loading component if you wish.
  if (!isNavigationStateRestored || !isI18nInitialized || (!areFontsLoaded && !fontLoadError)) {
    return null
  }

  const linking = {
    prefixes: [prefix],
    config,
  }

  // otherwise, we're ready to render the app
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <KeyboardProvider>
        <ThemeProvider>
          <WorkspaceProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <AppNavigator
                linking={linking}
                initialState={initialNavigationState}
                onStateChange={onNavigationStateChange}
              />
            </GestureHandlerRootView>
          </WorkspaceProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  )
}
