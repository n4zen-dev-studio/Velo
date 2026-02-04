import { ComponentProps } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs"

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
  PasswordResetConfirm: undefined
}

export type HomeStackParamList = {
  Home: undefined
  TaskEditor: { taskId?: string; projectId?: string } | undefined
  TaskDetail: { taskId: string }
  ConflictList: undefined
  ConflictResolution: { conflictId?: string } | undefined
  Invites: undefined
  InviteAccept: { token?: string } | undefined
}

export type MainTabParamList = {
  HomeTab: undefined
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

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>

export type AppStackParamList = RootStackParamList

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<RootStackParamList>>
> {}
