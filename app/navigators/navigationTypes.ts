import { ComponentProps } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"

// App Stack Navigator types
export type AppStackParamList = {
  Auth: undefined
  VerifyEmail: { email: string }
  PasswordResetRequest: undefined
  PasswordResetConfirm: undefined
  Home: undefined
  TaskEditor: { taskId?: string; projectId?: string }
  TaskDetail: { taskId: string }
  ConflictList: undefined
  ConflictResolution: { entityType: "task" | "comment"; entityId: string }
  Settings: undefined
  SyncDebug: undefined
  // 🔥 Your screens go here
  // IGNITE_GENERATOR_ANCHOR_APP_STACK_PARAM_LIST
}

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<AppStackParamList>>
> {}
