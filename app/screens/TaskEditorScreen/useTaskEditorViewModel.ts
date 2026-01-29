export const useTaskEditorViewModel = () => {
  return {
    title: "Design offline task editor",
    description: "Capture title, description, and metadata with local validation.",
    priorities: ["low", "medium", "high"] as const,
    statuses: ["Backlog", "To Do", "In Progress", "Review", "Done"],
  }
}
