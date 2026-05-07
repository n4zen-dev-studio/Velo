import { ComponentProps } from "react"
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs"
import { NavigationContainer } from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"

export type RootStackParamList = {
  Onboarding: undefined
  AuthGate: undefined
}

export type AuthGateParamList = {
  AuthStack: undefined
  MainTabs: undefined
}

export type OnboardingStackParamList = {
  Onboarding: undefined
}

export type AuthStackParamList = {
  Auth: undefined
  VerifyEmail: { email?: string } | undefined
  PasswordResetRequest: undefined
  PasswordResetConfirm: { email?: string } | undefined
}

export type HomeStackParamList = {
  Home: undefined
  TaskEditor: { taskId?: string; projectId?: string } | undefined
  TaskDetail: { taskId: string }
  Invites: undefined
  InviteAccept: { token?: string } | undefined
  Profile: undefined
}

export type SyncStackParamList = {
  SyncConsole: undefined
  ConflictList: undefined
  ConflictResolution: { conflictId?: string } | undefined
}

export type ProjectsStackParamList = {
  ProjectsEntry: undefined
  ProjectsHome: undefined
  ProjectDetail: { workspaceId: string }
  TaskEditor: { taskId?: string; projectId?: string } | undefined
  TaskDetail: { taskId: string }
}

export type MainTabParamList = {
  DashboardTab: undefined
  ProjectsTab: undefined
  SettingsTab: undefined
  DebugTab: undefined
}

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>

export type HomeStackScreenProps<T extends keyof HomeStackParamList> = NativeStackScreenProps<
  HomeStackParamList,
  T
>

export type SyncStackScreenProps<T extends keyof SyncStackParamList> = NativeStackScreenProps<
  SyncStackParamList,
  T
>

export type ProjectsStackScreenProps<T extends keyof ProjectsStackParamList> =
  NativeStackScreenProps<ProjectsStackParamList, T>

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>

export type AppStackParamList = RootStackParamList

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<RootStackParamList>>
> {}
