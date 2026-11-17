import { MediaEmpty } from '../components/MediaEmpty'

export function MediaPage() {
  return (
    <div className="flex w-full flex-col px-5 pt-8 pb-24 sm:min-h-0 sm:flex-1 sm:px-10 sm:py-10">
      <h1 className="sr-only">Media</h1>
      <MediaEmpty />
    </div>
  )
}
