import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'

import type {
  AdminCourse,
  AdminVideo,
  CourseInput,
  Entitlement,
} from '../lib/api'
import {
  createCourse,
  deleteCourse,
  deleteVideo,
  formatPrice,
  getAdminCourse,
  grantEntitlement,
  listAdminCourses,
  listEntitlements,
  orderVideos,
  revokeEntitlement,
  updateCourse,
  updateVideo,
} from '../lib/api'
import { authClient } from '../lib/auth-client'
import { useLoad } from '../lib/use-load'
import { uploadCourseVideo } from '../lib/video-upload'
import { PageState } from '../components/ui'

function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Admin navigation">
      <NavLink end to="/admin">
        Overview
      </NavLink>
      <NavLink to="/admin/courses">Courses</NavLink>
      <NavLink to="/admin/users">Users & access</NavLink>
    </nav>
  )
}

function AdminHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string
  title: string
  action?: React.ReactNode
}) {
  return (
    <>
      <AdminNav />
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        {action}
      </header>
    </>
  )
}

export function AdminDashboardPage() {
  const loadCourses = useCallback(() => listAdminCourses(), [])
  const loadEntitlements = useCallback(() => listEntitlements(), [])
  const courses = useLoad(loadCourses)
  const entitlements = useLoad(loadEntitlements)
  const published =
    courses.data?.courses.filter((course) => course.status === 'published')
      .length ?? 0
  const activeAccess =
    entitlements.data?.entitlements.filter((item) => !item.revokedAt).length ??
    0

  return (
    <main className="admin-shell">
      <AdminHeader eyebrow="Admin" title="Academy overview" />
      <section className="stat-grid">
        <article>
          <span>Total courses</span>
          <strong>{courses.data?.courses.length ?? '—'}</strong>
        </article>
        <article>
          <span>Published</span>
          <strong>{published}</strong>
        </article>
        <article>
          <span>Active access</span>
          <strong>{activeAccess}</strong>
        </article>
      </section>
      <section className="admin-callout">
        <div>
          <span className="eyebrow eyebrow-gold">Content</span>
          <h2>Keep every lesson current.</h2>
          <p>
            Create courses, order videos, and control who can access the
            library.
          </p>
        </div>
        <Link className="button button-light" to="/admin/courses">
          Manage courses
        </Link>
      </section>
    </main>
  )
}

export function AdminCoursesPage() {
  const load = useCallback(() => listAdminCourses(), [])
  const { data, error, loading, setData } = useLoad(load)

  async function removeCourse(course: AdminCourse) {
    if (!window.confirm(`Delete ${course.name}?`)) {
      return
    }
    await deleteCourse(course.id)
    if (data) {
      setData({ courses: data.courses.filter((item) => item.id !== course.id) })
    }
  }

  return (
    <main className="admin-shell">
      <AdminHeader
        eyebrow="Curriculum"
        title="Courses"
        action={
          <Link className="button" to="/admin/courses/new">
            New course
          </Link>
        }
      />
      {loading ? <p className="muted">Loading courses…</p> : null}
      {error ? <p className="inline-error">{error}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Status</th>
              <th>Price</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.courses.map((course) => (
              <tr key={course.id}>
                <td>
                  <strong>{course.name}</strong>
                  <small>/{course.slug}</small>
                </td>
                <td>
                  <span className={`status-badge status-${course.status}`}>
                    {course.status}
                  </span>
                </td>
                <td>{formatPrice(course.pricePaise, course.currency)}</td>
                <td className="table-actions">
                  <Link to={`/admin/courses/${course.id}`}>Edit</Link>
                  <button
                    type="button"
                    onClick={() => void removeCourse(course)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

const emptyCourse: CourseInput = {
  name: '',
  slug: '',
  description: '',
  pricePaise: 0,
  currency: 'INR',
  status: 'draft',
  metadata: {},
}

function CourseFields({
  value,
  onChange,
}: {
  value: CourseInput
  onChange: (course: CourseInput) => void
}) {
  return (
    <div className="form-grid">
      <label className="field-wide">
        Course name
        <input
          value={value.name}
          required
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </label>
      <label>
        Slug
        <input
          value={value.slug}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          onChange={(event) => onChange({ ...value, slug: event.target.value })}
        />
      </label>
      <label>
        Status
        <select
          value={value.status}
          onChange={(event) => {
            const status = event.target.value
            if (
              status === 'draft' ||
              status === 'published' ||
              status === 'archived'
            ) {
              onChange({ ...value, status })
            }
          }}
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <label>
        Price in rupees
        <input
          type="number"
          min="0"
          value={value.pricePaise / 100}
          onChange={(event) =>
            onChange({
              ...value,
              pricePaise: Math.round(Number(event.target.value) * 100),
            })
          }
        />
      </label>
      <label>
        Currency
        <input
          value={value.currency}
          maxLength={3}
          required
          onChange={(event) =>
            onChange({ ...value, currency: event.target.value.toUpperCase() })
          }
        />
      </label>
      <label className="field-wide">
        Description
        <textarea
          rows={5}
          value={value.description}
          onChange={(event) =>
            onChange({ ...value, description: event.target.value })
          }
        />
      </label>
      <label>
        Category
        <input
          value={value.metadata.category ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              metadata: { ...value.metadata, category: event.target.value },
            })
          }
        />
      </label>
      <label>
        Language
        <input
          value={value.metadata.language ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              metadata: { ...value.metadata, language: event.target.value },
            })
          }
        />
      </label>
      <label>
        Duration label
        <input
          value={value.metadata.durationLabel ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              metadata: {
                ...value.metadata,
                durationLabel: event.target.value,
              },
            })
          }
        />
      </label>
    </div>
  )
}

export function NewCoursePage() {
  const [course, setCourse] = useState(emptyCourse)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await createCourse(course)
      navigate(`/admin/courses/${result.course.id}`)
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not create course',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="admin-shell">
      <AdminHeader eyebrow="Curriculum" title="Create course" />
      <form className="admin-form-card" onSubmit={submit}>
        <CourseFields value={course} onChange={setCourse} />
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-actions">
          <Link className="button button-secondary" to="/admin/courses">
            Cancel
          </Link>
          <button className="button" type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create course'}
          </button>
        </div>
      </form>
    </main>
  )
}

export function EditCoursePage() {
  const { id = '' } = useParams()
  const load = useCallback(() => getAdminCourse(id), [id])
  const { data, error, loading, setData } = useLoad(load)
  const [course, setCourse] = useState<CourseInput | null>(null)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [videoName, setVideoName] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadController, setUploadController] =
    useState<AbortController | null>(null)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    if (data?.course && !course) {
      setCourse({
        name: data.course.name,
        slug: data.course.slug,
        description: data.course.description,
        pricePaise: data.course.pricePaise,
        currency: data.course.currency,
        status: data.course.status,
        metadata: data.course.metadata,
      })
    }
  }, [course, data?.course])

  async function saveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!course) return
    setFormError('')
    setMessage('')
    try {
      const result = await updateCourse(id, course)
      if (data) setData({ ...data, course: result.course })
      setMessage('Course details saved.')
    } catch (saveError: unknown) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save course',
      )
    }
  }

  async function addLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!videoFile || uploadController) return

    const controller = new AbortController()
    setUploadController(controller)
    setUploadError('')
    setUploadProgress(0)

    try {
      const result = await uploadCourseVideo({
        courseId: id,
        videoName,
        durationSeconds: durationMinutes
          ? Number(durationMinutes) * 60
          : undefined,
        file: videoFile,
        signal: controller.signal,
        onProgress: (uploadedBytes, totalBytes) => {
          setUploadProgress(Math.round((uploadedBytes / totalBytes) * 100))
        },
      })
      if (data) setData({ ...data, videos: [...data.videos, result.video] })
      setVideoName('')
      setDurationMinutes('')
      setVideoFile(null)
      setFileInputKey((current) => current + 1)
      setUploadProgress(100)
    } catch (uploadFailure: unknown) {
      let message = 'Could not upload the video'
      if (controller.signal.aborted) {
        message = 'Upload cancelled.'
      } else if (uploadFailure instanceof Error) {
        message = uploadFailure.message
      }
      setUploadError(message)
    } finally {
      setUploadController(null)
    }
  }

  async function renameLesson(video: AdminVideo) {
    const name = window.prompt('Lesson name', video.name)
    if (!name || name === video.name) return
    const result = await updateVideo(video.id, { name })
    if (data)
      setData({
        ...data,
        videos: data.videos.map((item) =>
          item.id === video.id ? result.video : item,
        ),
      })
  }

  async function removeLesson(video: AdminVideo) {
    if (!window.confirm(`Delete ${video.name}?`)) return
    await deleteVideo(video.id)
    if (data)
      setData({
        ...data,
        videos: data.videos.filter((item) => item.id !== video.id),
      })
  }

  async function moveLesson(index: number, direction: -1 | 1) {
    if (!data) return
    const target = index + direction
    if (target < 0 || target >= data.videos.length) return
    const nextVideos = [...data.videos]
    const current = nextVideos[index]
    const other = nextVideos[target]
    if (!current || !other) return
    nextVideos[index] = other
    nextVideos[target] = current
    const result = await orderVideos(
      id,
      nextVideos.map((video) => video.id),
    )
    setData({ ...data, videos: result.videos })
  }

  if (loading) return <PageState>Loading course editor…</PageState>
  if (error || !data || !course)
    return <PageState>{error || 'Course not found'}</PageState>

  return (
    <main className="admin-shell">
      <AdminHeader
        eyebrow="Curriculum"
        title={data.course.name}
        action={
          <Link
            className="button button-secondary"
            to={`/courses/${data.course.slug}`}
          >
            View public page
          </Link>
        }
      />
      <form className="admin-form-card" onSubmit={saveCourse}>
        <CourseFields value={course} onChange={setCourse} />
        {formError ? <p className="form-error">{formError}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}
        <div className="form-actions">
          <button className="button" type="submit">
            Save changes
          </button>
        </div>
      </form>

      <section className="admin-section-card">
        <div className="admin-section-heading">
          <div>
            <span className="eyebrow">Lessons</span>
            <h2>Video order</h2>
          </div>
          <span>{data.videos.length} lessons</span>
        </div>
        <div className="admin-video-list">
          {data.videos.map((video, index) => (
            <div key={video.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{video.name}</strong>
                <small>
                  {Math.round((video.durationSeconds ?? 0) / 60)} min ·{' '}
                  {video.objectKey}
                </small>
              </div>
              <div className="row-buttons">
                <button
                  type="button"
                  aria-label="Move lesson up"
                  onClick={() => void moveLesson(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move lesson down"
                  onClick={() => void moveLesson(index, 1)}
                >
                  ↓
                </button>
                <button type="button" onClick={() => void renameLesson(video)}>
                  Rename
                </button>
                <button type="button" onClick={() => void removeLesson(video)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <form className="inline-add-form" onSubmit={addLesson}>
          <label>
            Lesson name
            <input
              value={videoName}
              required
              onChange={(event) => setVideoName(event.target.value)}
            />
          </label>
          <label>
            Video file
            <input
              key={fileInputKey}
              type="file"
              accept="video/*"
              required
              disabled={Boolean(uploadController)}
              onChange={(event) =>
                setVideoFile(event.target.files?.item(0) ?? null)
              }
            />
          </label>
          <label>
            Minutes
            <input
              type="number"
              min="0"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
          </label>
          <div className="video-upload-actions">
            <button
              className="button"
              type="submit"
              disabled={Boolean(uploadController)}
            >
              {uploadController ? 'Uploading…' : 'Upload lesson'}
            </button>
            {uploadController ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => uploadController.abort()}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        {uploadController || uploadProgress > 0 ? (
          <div className="video-upload-progress" aria-live="polite">
            <div>
              <span style={{ width: `${uploadProgress}%` }} />
            </div>
            <p>{uploadProgress}% uploaded directly to private R2</p>
          </div>
        ) : null}
        {uploadError ? <p className="form-error">{uploadError}</p> : null}
      </section>
    </main>
  )
}

type AdminUser = {
  id: string
  name: string
  email: string
  role?: string
  banned: boolean | null
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [selectedCourses, setSelectedCourses] = useState<
    Record<string, string>
  >({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [userResult, courseResult, entitlementResult] = await Promise.all([
      authClient.admin.listUsers({ query: { limit: 100 } }),
      listAdminCourses(),
      listEntitlements(),
    ])
    if (userResult.error)
      throw new Error(userResult.error.message ?? 'Could not load users')
    setUsers(userResult.data.users)
    setCourses(courseResult.courses)
    setEntitlements(entitlementResult.entitlements)
  }, [])

  useEffect(() => {
    load()
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load users',
        ),
      )
      .finally(() => setLoading(false))
  }, [load])

  async function changeRole(user: AdminUser) {
    const role = user.role === 'admin' ? 'user' : 'admin'
    const result = await authClient.admin.setRole({ userId: user.id, role })
    if (result.error) {
      setError(result.error.message ?? 'Could not change role')
      return
    }
    setUsers((items) =>
      items.map((item) => (item.id === user.id ? { ...item, role } : item)),
    )
  }

  async function changeBan(user: AdminUser) {
    const result = user.banned
      ? await authClient.admin.unbanUser({ userId: user.id })
      : await authClient.admin.banUser({
          userId: user.id,
          banReason: 'Disabled by an academy admin',
        })
    if (result.error) {
      setError(result.error.message ?? 'Could not update user')
      return
    }
    setUsers((items) =>
      items.map((item) =>
        item.id === user.id ? { ...item, banned: !user.banned } : item,
      ),
    )
  }

  async function grant(userId: string) {
    const courseId = selectedCourses[userId]
    if (!courseId) return
    await grantEntitlement(userId, courseId)
    const result = await listEntitlements()
    setEntitlements(result.entitlements)
  }

  async function revoke(item: Entitlement) {
    await revokeEntitlement(item.id)
    const result = await listEntitlements()
    setEntitlements(result.entitlements)
  }

  return (
    <main className="admin-shell">
      <AdminHeader eyebrow="People" title="Users & course access" />
      {loading ? <p className="muted">Loading users…</p> : null}
      {error ? <p className="inline-error">{error}</p> : null}
      <div className="user-admin-list">
        {users.map((user) => {
          const userAccess = entitlements.filter(
            (item) => item.user.id === user.id && !item.revokedAt,
          )
          return (
            <article key={user.id}>
              <div className="user-heading">
                <div className="avatar">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2>{user.name}</h2>
                  <p>{user.email}</p>
                </div>
                <span
                  className={`status-badge ${user.banned ? 'status-archived' : 'status-published'}`}
                >
                  {user.banned ? 'banned' : (user.role ?? 'user')}
                </span>
              </div>
              <div className="user-actions">
                <button type="button" onClick={() => void changeRole(user)}>
                  {user.role === 'admin' ? 'Make user' : 'Make admin'}
                </button>
                <button type="button" onClick={() => void changeBan(user)}>
                  {user.banned ? 'Unban' : 'Ban'}
                </button>
              </div>
              <div className="access-list">
                {userAccess.map((item) => (
                  <span key={item.id}>
                    {item.course.name}
                    <button type="button" onClick={() => void revoke(item)}>
                      Revoke
                    </button>
                  </span>
                ))}
              </div>
              <div className="grant-row">
                <select
                  value={selectedCourses[user.id] ?? ''}
                  onChange={(event) =>
                    setSelectedCourses((items) => ({
                      ...items,
                      [user.id]: event.target.value,
                    }))
                  }
                >
                  <option value="">Choose a course</option>
                  {courses.map((course) => (
                    <option value={course.id} key={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
                <button
                  className="button button-small"
                  type="button"
                  onClick={() => void grant(user.id)}
                >
                  Grant access
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}
