export async function initializeApp() {
  const [{ createCliRenderer }, { createRoot }, { DiffApp }, repositoriesModel, workspacesModel] = await Promise.all([
    import("@opentui/core"),
    import("@opentui/react"),
    import("./DiffApp"),
    import("../features/repositories/model/repositories"),
    import("../features/repositories/model/workspaces"),
  ])
  const { resolveRepositories } = repositoriesModel
  const { isPersistableWorkspace, readSavedWorkspaceState } = workspacesModel

  return {
    createCliRenderer,
    createRoot,
    DiffApp,
    resolveRepositories,
    isPersistableWorkspace,
    readSavedWorkspaceState,
  }
}
