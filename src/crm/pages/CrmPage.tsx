import { CrmEmpty } from '../components/CrmEmpty'

export function CrmPage() {
  return (
    <div className="flex w-full flex-col px-5 pt-8 pb-24 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
      <h1 className="sr-only">CRM</h1>
      <CrmEmpty />
    </div>
  )
}
