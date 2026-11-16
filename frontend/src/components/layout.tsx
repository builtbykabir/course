import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { authClient } from '../lib/auth-client'

function Logo() {
  return (
    <Link className="logo" to="/" aria-label="Feminy Academy home">
      <span className="logo-mark">F</span>
      <span>
        <strong>Feminy</strong>
        <small>Academy</small>
      </span>
    </Link>
  )
}

export function Layout() {
  const { data: session, isPending } = authClient.useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  async function signOut() {
    await authClient.signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const isAdmin = session?.user.role === 'admin'

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <button
            className="menu-button"
            type="button"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
          <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'}>
            <NavLink to="/courses" onClick={() => setMenuOpen(false)}>
              Courses
            </NavLink>
            {session ? (
              <>
                <NavLink to="/purchases" onClick={() => setMenuOpen(false)}>
                  My learning
                </NavLink>
                <NavLink to="/profile" onClick={() => setMenuOpen(false)}>
                  Profile
                </NavLink>
                {isAdmin ? (
                  <NavLink to="/admin" onClick={() => setMenuOpen(false)}>
                    Admin
                  </NavLink>
                ) : null}
                <button className="nav-button" type="button" onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : isPending ? null : (
              <Link
                className="button button-small"
                to="/login"
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <Logo />
            <p>
              Practical beauty education in simple Hindi and Hinglish, built for
              learning at your own pace.
            </p>
          </div>
          <div>
            <h3>Learn</h3>
            <Link to="/courses">Browse courses</Link>
            <Link to="/purchases">My learning</Link>
          </div>
          <div>
            <h3>Account</h3>
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Create account</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Feminy Academy</span>
          <span>Online beauty education</span>
        </div>
      </footer>
    </div>
  )
}
