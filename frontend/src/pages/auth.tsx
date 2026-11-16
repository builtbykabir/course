import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { authClient } from '../lib/auth-client'

function GoogleButton() {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/purchases`,
    })
    setLoading(false)
  }

  return (
    <button
      className="button button-google"
      type="button"
      disabled={loading}
      onClick={signInWithGoogle}
    >
      <span className="google-mark">G</span>
      {loading ? 'Opening Google…' : 'Continue with Google'}
    </button>
  )
}

export function LoginPage() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) {
    return <Navigate to="/purchases" replace />
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const result = await authClient.signIn.email({ email, password })
    setLoading(false)

    if (result.error) {
      setError(result.error.message ?? 'Could not sign in')
      return
    }

    const returnPath = location.state?.from
    navigate(typeof returnPath === 'string' ? returnPath : '/purchases')
  }

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <span className="eyebrow eyebrow-gold">Welcome back</span>
        <h1>Continue from your last lesson.</h1>
        <p>Your courses, lesson progress, and profile stay together.</p>
      </section>
      <section className="auth-card">
        <h2>Sign in</h2>
        <p>Use your email or Google account.</p>
        <GoogleButton />
        <div className="divider">
          <span>or</span>
        </div>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button
            className="button button-full"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          New to Feminy? <Link to="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  )
}

export function SignupPage() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) {
    return <Navigate to="/purchases" replace />
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    const result = await authClient.signUp.email({ name, email, password })
    setLoading(false)

    if (result.error) {
      setError(result.error.message ?? 'Could not create your account')
      return
    }

    if (result.data?.user.emailVerified) {
      navigate('/purchases')
      return
    }

    setMessage('Check your email to verify your account, then sign in.')
  }

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <span className="eyebrow eyebrow-gold">Start learning</span>
        <h1>One account for every practical lesson.</h1>
        <p>Create your profile and keep your course progress saved.</p>
      </section>
      <section className="auth-card">
        <h2>Create account</h2>
        <p>Start with Google or your email address.</p>
        <GoogleButton />
        <div className="divider">
          <span>or</span>
        </div>
        <form onSubmit={submit}>
          <label>
            Your name
            <input
              value={name}
              autoComplete="name"
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              minLength={8}
              autoComplete="new-password"
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}
          <button
            className="button button-full"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
