import type { Project, Status, Task, Workspace } from "@/services/db/types"

export interface HomeData {
  workspaces: Workspace[]
  projects: Project[]
  statuses: Status[]
  tasks: Task[]
}
