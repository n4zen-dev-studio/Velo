import { navigationRef } from "@/navigators/navigationUtilities"

function resetToMainTabs() {
  if (!navigationRef.isReady()) return
  navigationRef.resetRoot({
    index: 0,
    routes: [
      {
        name: "AuthGate" as never,
        state: {
          routes: [
            {
              name: "MainTabs" as never,
              state: {
                routes: [
                  {
                    name: "HomeTab" as never,
                    state: { routes: [{ name: "Home" as never }] },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  })
}

export function goToHome() {
  resetToMainTabs()
}

export function goToHomeTab() {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "MainTabs",
    params: { screen: "HomeTab" },
  } as never)
}

export function goToSettingsTab() {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "MainTabs",
    params: { screen: "SettingsTab" },
  } as never)
}

export function goToDebugTab() {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "MainTabs",
    params: { screen: "DebugTab" },
  } as never)
}

export function goToTaskDetail(taskId: string) {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "MainTabs",
    params: {
      screen: "HomeTab",
      params: { screen: "TaskDetail", params: { taskId } },
    },
  } as never)
}

export function goToTaskEditor(params?: { taskId?: string; projectId?: string }) {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "MainTabs",
    params: {
      screen: "HomeTab",
      params: { screen: "TaskEditor", params },
    },
  } as never)
}

export function goToConflictList() {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "MainTabs",
    params: {
      screen: "HomeTab",
      params: { screen: "ConflictList" },
    },
  } as never)
}

export function goToConflictResolution(params?: { conflictId?: string }) {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "MainTabs",
    params: {
      screen: "HomeTab",
      params: { screen: "ConflictResolution", params },
    },
  } as never)
}

export function goToAuth() {
  if (!navigationRef.isReady()) return
  navigationRef.resetRoot({
    index: 0,
    routes: [
      {
        name: "AuthGate" as never,
        state: { routes: [{ name: "AuthStack" as never, state: { routes: [{ name: "Auth" as never }] } }] },
      },
    ],
  })
}

export function goToVerifyEmail() {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "AuthStack",
    params: { screen: "VerifyEmail" },
  } as never)
}

export function goToPasswordResetRequest() {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "AuthStack",
    params: { screen: "PasswordResetRequest" },
  } as never)
}

export function goToPasswordResetConfirm() {
  if (!navigationRef.isReady()) return
  navigationRef.navigate("AuthGate" as never, {
    screen: "AuthStack",
    params: { screen: "PasswordResetConfirm" },
  } as never)
}
