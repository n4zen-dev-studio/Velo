export const useConflictResolutionViewModel = () => {
  return {
    title: "Sync engine deep dive",
    local: {
      status: "In Progress",
      description: "Local edits include updated scope and acceptance criteria.",
    },
    server: {
      status: "Review",
      description: "Server edits adjust the priority and status for QA.",
    },
  }
}
