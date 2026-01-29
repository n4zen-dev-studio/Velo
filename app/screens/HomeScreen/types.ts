import type { Project, Status, Task } from "@/services/db/types"

export interface Workspace {
  id: string
  label: string
  projectId: string | null
}

export interface HomeData {
  workspaces: Workspace[]
  projects: Project[]
  statuses: Status[]
  tasks: Task[]
}
