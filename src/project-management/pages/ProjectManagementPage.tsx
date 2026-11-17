import { ProjectManagementEmpty } from '../components/ProjectManagementEmpty'

export function ProjectManagementPage() {
  return (
    <div className="flex w-full flex-col px-5 pt-8 pb-24 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
      <h1 className="sr-only">Project Management</h1>
      <ProjectManagementEmpty />
    </div>
  )
}
