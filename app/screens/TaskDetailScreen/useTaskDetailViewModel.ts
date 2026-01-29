export const useTaskDetailViewModel = () => {
  return {
    title: "Sync engine deep dive",
    description: "Map delta sync to change log ops and highlight merge rules.",
    status: "In Progress",
    priority: "high",
    assignee: "You",
    comments: [
      { id: "comment-1", author: "Morgan", body: "Waiting on the retry strategy draft." },
      { id: "comment-2", author: "You", body: "Working through the conflict flow now." },
    ],
    timeline: [
      "Task created · 2 days ago",
      "Status moved to In Progress · 6 hours ago",
      "Comment added · 15 minutes ago",
    ],
    hasConflict: true,
  }
}
