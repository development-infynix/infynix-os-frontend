import { ClientsEmpty } from '../components/ClientsEmpty'

export function ClientsPage() {
  return (
    <div className="flex w-full flex-col px-5 pt-8 pb-24 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
      <h1 className="sr-only">Clients</h1>
      <ClientsEmpty />
    </div>
  )
}
