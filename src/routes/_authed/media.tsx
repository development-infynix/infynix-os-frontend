import { createFileRoute } from '@tanstack/react-router'
import { MediaPage } from '@/media/pages/MediaPage'
import { requireAccess } from '@/lib/access'

export const Route = createFileRoute('/_authed/media')({
  beforeLoad: ({ context }) => requireAccess(context.session, 'media'),
  component: MediaPage,
})
