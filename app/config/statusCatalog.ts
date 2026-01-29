export type StatusCategory = "todo" | "in_progress" | "done"

export interface StatusCatalogItem {
  id: string
  name: string
  orderIndex: number
  category: StatusCategory
}

export const DEFAULT_STATUS_CATALOG: StatusCatalogItem[] = [
  { id: "backlog", name: "Backlog", orderIndex: 0, category: "todo" },
  { id: "todo", name: "To Do", orderIndex: 1, category: "todo" },
  { id: "in_progress", name: "In Progress", orderIndex: 2, category: "in_progress" },
  { id: "review", name: "Review", orderIndex: 3, category: "in_progress" },
  { id: "done", name: "Done", orderIndex: 4, category: "done" },
]
