import { Link } from '@tanstack/react-router'
import { AuthLayout } from '../components/AuthLayout'
import { Login } from '../components/Login'

export function LoginPage() {
  return (
    <AuthLayout
      title="Sign in to Infynix OS"
      subtitle="Use the work email your company account was set up with."
      footer={
        <p>
          New to Infynix OS?{' '}
          <Link to="/signup" className="font-medium text-secondary-text underline-offset-4 hover:underline">
            Create your company account
          </Link>
        </p>
      }
    >
      <Login />
    </AuthLayout>
  )
}
