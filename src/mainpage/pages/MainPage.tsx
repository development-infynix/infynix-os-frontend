import { ROLE_LABEL, useSession } from '@/lib/auth'

export function MainPage() {
  const { user, tenant } = useSession()
  const firstName = user.fullName.split(' ')[0]

  return (
    <div className="w-full max-w-5xl px-5 py-10 tabular-nums sm:px-10 sm:py-12">
      <h1 className="text-display font-semibold leading-tight tracking-display text-ink sm:text-display-lg">
        Hello, {firstName}
      </h1>
      <p className="mt-2 text-body-lg text-ink-2">
        You’re in <span className="font-medium text-ink">{tenant.name}</span> as{' '}
        <span className="font-medium text-secondary-text">{ROLE_LABEL[user.role]}</span>.
      </p>
    </div>
  )
}
