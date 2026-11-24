import { ListTodo, Megaphone, Users } from 'lucide-react'

/** One icon per event type, shared by the new-event menu and the day cards. */
export const TYPE_ICON = { announcement: Megaphone, meeting: Users, task: ListTodo } as const
