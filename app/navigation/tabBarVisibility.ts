import type { NavigationState, PartialState, Route } from "@react-navigation/native"

const HIDDEN_TAB_BAR_ROUTES = new Set(["TaskEditor", "ProjectsHome", "TaskDetail", "ConflictList", "ConflictResolution", "Invites","InviteAccept", "Profile" ])


type RouteLike = Route<string> & {
  state?: NavigationState | PartialState<NavigationState>
}

export function getDeepestFocusedRouteName(route: RouteLike | undefined): string | null {
  if (!route) return null
  const nestedState = route.state
  if (!nestedState || !nestedState.routes?.length) return route.name

  const focusedIndex = nestedState.index ?? nestedState.routes.length - 1
  const focusedRoute = nestedState.routes[focusedIndex] as RouteLike | undefined
  return getDeepestFocusedRouteName(focusedRoute)
}

export function shouldHideFloatingTabs(routeName: string | null | undefined) {
  if (!routeName) return false
  return HIDDEN_TAB_BAR_ROUTES.has(routeName)
}
