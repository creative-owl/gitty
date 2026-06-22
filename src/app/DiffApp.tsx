import type { RepositoryView } from "../features/repositories/model/types"
import { AppThemeContext, type ThemeName } from "../shared/theme"
import { DiffAppView } from "./DiffAppView"
import { useDiffAppController } from "./useDiffAppController"

export type DiffAppProps = {
  initialRepositories: RepositoryView[]
  persistWorkspaces: boolean
  staged: boolean
  theme: ThemeName
}

export function DiffApp(props: DiffAppProps) {
  const controller = useDiffAppController(props)

  return (
    <AppThemeContext.Provider value={controller.appTheme}>
      <DiffAppView controller={controller} />
    </AppThemeContext.Provider>
  )
}
