import { Link } from '@tanstack/react-router'
import { AuthLayout } from '../components/AuthLayout'

/**
 * Where "Forgot password?" leads. Until email reset ships (Resend), passwords
 * are reset by the company's owner or a manager from the Members page.
 */
export function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Your company’s owner or a manager can set a new one for you."
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink-2">
          Ask them to open <span className="font-medium text-ink">Members</span>, choose{' '}
          <span className="font-medium text-ink">Edit</span> next to your name and set a new password. Then sign in
          with it.
        </p>
        <p className="text-body text-ink-2">
          If you’re the owner and can’t sign in, contact Infynix support.
        </p>
        <Link to="/login" className="btn btn-primary mt-1 h-10 w-full px-4 text-body">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  )
}
