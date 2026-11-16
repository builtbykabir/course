import { useEffect, useState } from 'react'

import { authClient } from '../lib/auth-client'

export function ProfilePage() {
  const { data: session } = authClient.useSession()
  const [name, setName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (session?.user.name) {
      setName(session.user.name)
    }
  }, [session?.user.name])

  async function updateName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    const result = await authClient.updateUser({ name })
    if (result.error) {
      setError(result.error.message ?? 'Could not update your name')
      return
    }
    setMessage('Your name has been updated.')
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    if (result.error) {
      setError(result.error.message ?? 'Could not update your password')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setMessage('Your password has been updated.')
  }

  return (
    <main className="page-shell profile-page">
      <section className="page-hero compact-hero">
        <span className="eyebrow">Your profile</span>
        <h1>Account settings</h1>
        <p>{session?.user.email}</p>
      </section>
      <div className="settings-grid">
        <form className="settings-card" onSubmit={updateName}>
          <h2>Personal details</h2>
          <label>
            Display name
            <input
              value={name}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button className="button" type="submit">
            Save name
          </button>
        </form>
        <form className="settings-card" onSubmit={updatePassword}>
          <h2>Change password</h2>
          <label>
            Current password
            <input
              type="password"
              value={currentPassword}
              autoComplete="current-password"
              required
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              minLength={8}
              required
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <button className="button" type="submit">
            Update password
          </button>
        </form>
      </div>
      {error ? <p className="form-error settings-message">{error}</p> : null}
      {message ? (
        <p className="form-success settings-message">{message}</p>
      ) : null}
    </main>
  )
}
