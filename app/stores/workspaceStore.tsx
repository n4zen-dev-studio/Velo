import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react"

import type { Workspace } from "@/services/db/types"
import {
  createWorkspace as createWorkspaceRepo,
  listWorkspaces,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  renameWorkspace as renameWorkspaceRepo,
  deleteWorkspace as deleteWorkspaceRepo,
  PERSONAL_WORKSPACE_LABEL,
  personalWorkspaceId,
} from "@/services/db/repositories/workspacesRepository"
import { ensureBootstrappedForScope } from "@/services/db/bootstrap"
import { getActiveScopeKey, GUEST_SCOPE_KEY } from "@/services/session/scope"
import { useAuthSession } from "@/services/auth/session"

interface WorkspaceStoreValue {
  workspaces: Workspace[]
  activeWorkspaceId: string
  activeWorkspace: Workspace | null
  isHydrated: boolean
  hydrate: () => Promise<void>
  refreshWorkspaces: () => Promise<void>
  setActiveWorkspaceId: (id: string) => Promise<void>
  createWorkspace: (label: string, setActive?: boolean) => Promise<Workspace>
  renameWorkspace: (id: string, label: string) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
}

const defaultWorkspace = (scopeKey: string): Workspace => ({
  id: personalWorkspaceId(scopeKey),
  label: PERSONAL_WORKSPACE_LABEL,
  kind: "personal",
  createdAt: 0,
  updatedAt: 0,
  remoteId: null,
  scopeKey,
})

const WorkspaceContext = createContext<WorkspaceStoreValue | null>(null)

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const authSession = useAuthSession()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([defaultWorkspace(GUEST_SCOPE_KEY)])
  const [activeWorkspaceIdState, setActiveWorkspaceIdState] = useState(
    personalWorkspaceId(GUEST_SCOPE_KEY),
  )
  const [isHydrated, setIsHydrated] = useState(false)
  const lastValidWorkspaceIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (activeWorkspaceIdState && activeWorkspaceIdState !== personalWorkspaceId(GUEST_SCOPE_KEY)) {
      lastValidWorkspaceIdRef.current = activeWorkspaceIdState
    }
    console.log("[WorkspaceStore] activeWorkspaceId", { activeWorkspaceId: activeWorkspaceIdState })
  }, [activeWorkspaceIdState])

  const loadFromDb = useCallback(async () => {
    const scopeKey = await getActiveScopeKey()
    const isGuestSession = !authSession.currentUserId
    if (!isGuestSession && scopeKey === GUEST_SCOPE_KEY) {
      console.warn("[WorkspaceStore] Ignoring guest scope during authenticated session.")
      return
    }
    await ensureBootstrappedForScope(scopeKey)
    const [rows, activeId] = await Promise.all([
      listWorkspaces(scopeKey),
      getActiveWorkspaceId(scopeKey),
    ])
    const resolvedActive = activeId ?? personalWorkspaceId(scopeKey)
    const nextWorkspaces = rows.length > 0 ? rows : [defaultWorkspace(scopeKey)]
    setWorkspaces(nextWorkspaces)
    const resolvedIsGuestPersonal =
      resolvedActive === personalWorkspaceId(GUEST_SCOPE_KEY) && !isGuestSession
    const resolvedExists = nextWorkspaces.some((w) => w.id === resolvedActive)
    if (resolvedIsGuestPersonal) {
      const fallback = lastValidWorkspaceIdRef.current
      if (fallback && nextWorkspaces.some((w) => w.id === fallback)) {
        setActiveWorkspaceIdState((prev) => {
          console.log("[WorkspaceStore] setActiveWorkspaceId", { from: prev, to: fallback, reason: "ignore-guest" })
          return fallback
        })
        return
      }
      console.warn("[WorkspaceStore] Guest fallback blocked; keeping current active workspace.")
      return
    }
    if (!resolvedExists) {
      console.warn("[WorkspaceStore] Active workspace missing after refresh; keeping current.")
      return
    }
    setActiveWorkspaceIdState((prev) => {
      if (prev === resolvedActive) return prev
      console.log("[WorkspaceStore] setActiveWorkspaceId", { from: prev, to: resolvedActive, reason: "loadFromDb" })
      return resolvedActive
    })
    if (__DEV__) {
      const personalId = personalWorkspaceId(scopeKey)
      const hasPersonal = rows.some((w) => w.id === personalId)
      if (!hasPersonal) {
        // eslint-disable-next-line no-console
        console.warn("[Workspace] Personal workspace missing; bootstrapped fallback in memory.")
      }
      if (activeId !== resolvedActive) {
        // eslint-disable-next-line no-console
        console.info("[Workspace] Active workspace reset to Personal.")
      }
    }
  }, [authSession.currentUserId])

  const hydrate = useCallback(async () => {
    await loadFromDb()
    setIsHydrated(true)
  }, [loadFromDb])

  const refreshWorkspaces = useCallback(async () => {
    await loadFromDb()
  }, [loadFromDb])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    void refreshWorkspaces()
  }, [authSession.currentUserId, authSession.token, refreshWorkspaces])

  const setActiveWorkspace = useCallback(async (id: string) => {
    await setActiveWorkspaceId(id)
    setActiveWorkspaceIdState((prev) => {
      console.log("[WorkspaceStore] setActiveWorkspaceId", { from: prev, to: id, reason: "explicit" })
      return id
    })
  }, [])

  const createWorkspace = useCallback(async (label: string, setActive = true) => {
    const workspace = await createWorkspaceRepo(label)
    await refreshWorkspaces()
    if (setActive) {
      await setActiveWorkspace(workspace.id)
    }
    return workspace
  }, [refreshWorkspaces, setActiveWorkspace])

  const renameWorkspace = useCallback(async (id: string, label: string) => {
    await renameWorkspaceRepo(id, label)
    await refreshWorkspaces()
  }, [refreshWorkspaces])

  const deleteWorkspace = useCallback(async (id: string) => {
    await deleteWorkspaceRepo(id)
    await refreshWorkspaces()
    if (id === activeWorkspaceIdState) {
      const scopeKey = await getActiveScopeKey()
      await setActiveWorkspace(personalWorkspaceId(scopeKey))
    }
  }, [activeWorkspaceIdState, refreshWorkspaces, setActiveWorkspace])

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceIdState) ?? null
  }, [workspaces, activeWorkspaceIdState])

  const value = useMemo<WorkspaceStoreValue>(
    () => ({
      workspaces,
      activeWorkspaceId: activeWorkspaceIdState,
      activeWorkspace,
      isHydrated,
      hydrate,
      refreshWorkspaces,
      setActiveWorkspaceId: setActiveWorkspace,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
    }),
    [
      workspaces,
      activeWorkspaceIdState,
      activeWorkspace,
      isHydrated,
      hydrate,
      refreshWorkspaces,
      setActiveWorkspace,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
    ],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspaceStore() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspaceStore must be used within a WorkspaceProvider")
  }
  return context
}
