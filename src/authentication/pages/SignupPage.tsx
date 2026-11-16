import { Link } from '@tanstack/react-router'
import { AuthLayout } from '../components/AuthLayout'
import { Signup } from '../components/Signup'

export function SignupPage() {
  return (
    <AuthLayout
      title="Create your company account"
      subtitle="You’ll be the owner, and can add your employees once you’re in."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-secondary-text underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <Signup />
    </AuthLayout>
  )
}
