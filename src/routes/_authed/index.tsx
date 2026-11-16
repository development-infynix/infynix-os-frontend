import { createFileRoute } from '@tanstack/react-router'
import { MainPage } from '@/mainpage/pages/MainPage'

export const Route = createFileRoute('/_authed/')({
  component: MainPage,
})
