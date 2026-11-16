import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageState, ProgressBar, SectionHeading } from '../components/ui'
import {
  formatDuration,
  getCourseContent,
  getMyCourses,
  getPlayback,
  saveProgress,
} from '../lib/api'
import { useLoad } from '../lib/use-load'

export function PurchasesPage() {
  const load = useCallback(() => getMyCourses(), [])
  const { data, error, loading } = useLoad(load)

  return (
    <main className="page-shell">
      <section className="page-hero compact-hero">
        <SectionHeading
          eyebrow="My learning"
          title="Aapke courses"
          copy="Continue a course or check how much you have completed."
        />
      </section>
      <section className="section-inner learning-list">
        {loading ? <p className="muted">Loading your courses…</p> : null}
        {error ? <p className="inline-error">{error}</p> : null}
        {data?.courses.length === 0 ? (
          <div className="empty-card">
            <h2>No courses yet</h2>
            <p>An administrator can grant course access to your account.</p>
            <Link className="button" to="/courses">
              Browse courses
            </Link>
          </div>
        ) : null}
        {data?.courses.map((course) => {
          const total = course.progress.totalVideos
          const completed = course.progress.completedVideos
          const percentage = total ? (completed / total) * 100 : 0
          return (
            <article className="learning-card" key={course.id}>
              <div className="learning-card-art">
                <span>{course.metadata.category ?? 'Course'}</span>
                <strong>
                  {completed}/{total}
                </strong>
                <small>lessons complete</small>
              </div>
              <div className="learning-card-body">
                <span className="eyebrow">Continue learning</span>
                <h2>{course.name}</h2>
                <p>{course.description}</p>
                <ProgressBar value={percentage} />
                <div className="learning-card-footer">
                  <span>{Math.round(percentage)}% complete</span>
                  <Link
                    className="button"
                    to={`/courses/${course.slug}/content`}
                  >
                    Open course
                  </Link>
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

export function CourseContentPage() {
  const { slug = '' } = useParams()
  const load = useCallback(() => getCourseContent(slug), [slug])
  const { data, error, loading } = useLoad(load)

  if (loading) {
    return <PageState>Loading your lessons…</PageState>
  }

  if (error || !data) {
    return <PageState>{error || 'Course not found'}</PageState>
  }

  const completed = data.videos.filter(
    (video) => video.progress.completed,
  ).length
  const percentage = data.videos.length
    ? (completed / data.videos.length) * 100
    : 0

  return (
    <main className="page-shell content-page">
      <section className="content-hero">
        <div>
          <span className="eyebrow">Your course</span>
          <h1>{data.course.name}</h1>
          <p>{data.course.description}</p>
        </div>
        <div className="course-progress-summary">
          <strong>
            {completed}/{data.videos.length}
          </strong>
          <span>lessons complete</span>
          <ProgressBar value={percentage} />
        </div>
      </section>
      <section className="lesson-list-wrap">
        <div className="lesson-list-heading">
          <h2>Course lessons</h2>
          <span>{Math.round(percentage)}% complete</span>
        </div>
        <div className="lesson-list">
          {data.videos.map((video, index) => (
            <Link
              className={
                video.progress.completed
                  ? 'lesson-row is-complete'
                  : 'lesson-row'
              }
              to={`/courses/${slug}/content/${video.id}`}
              key={video.id}
            >
              <span className="lesson-number">
                {video.progress.completed
                  ? '✓'
                  : String(index + 1).padStart(2, '0')}
              </span>
              <span className="lesson-title">
                <strong>{video.name}</strong>
                <small>
                  {formatDuration(video.durationSeconds)}
                  {video.progress.positionSeconds > 0 &&
                  !video.progress.completed
                    ? ` · Resume at ${Math.floor(video.progress.positionSeconds / 60)} min`
                    : ''}
                </small>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}

export function PlayerPage() {
  const { slug = '', videoId = '' } = useParams()
  const load = useCallback(() => getCourseContent(slug), [slug])
  const { data, error, loading, setData } = useLoad(load)
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const [saving, setSaving] = useState(false)
  const player = useRef<HTMLVideoElement>(null)
  const lastSavedAt = useRef(0)
  const playbackRetries = useRef(0)

  const currentVideo = data?.videos.find((video) => video.id === videoId)
  const currentIndex =
    data?.videos.findIndex((video) => video.id === videoId) ?? -1

  useEffect(() => {
    if (!videoId) {
      return
    }

    playbackRetries.current = 0
    setPlaybackError('')
    getPlayback(videoId)
      .then((playback) => setPlaybackUrl(playback.url))
      .catch((loadError: unknown) => {
        setPlaybackError(
          loadError instanceof Error
            ? loadError.message
            : 'Playback is unavailable',
        )
      })
  }, [videoId])

  async function persistProgress(completed: boolean) {
    if (!currentVideo || saving) {
      return
    }

    const position = completed
      ? (currentVideo.durationSeconds ??
        Math.round(player.current?.currentTime ?? 0))
      : Math.round(
          player.current?.currentTime ?? currentVideo.progress.positionSeconds,
        )

    setSaving(true)
    await saveProgress(currentVideo.id, position, completed)
    setSaving(false)
    lastSavedAt.current = position

    if (data) {
      setData({
        ...data,
        videos: data.videos.map((video) =>
          video.id === currentVideo.id
            ? {
                ...video,
                progress: {
                  ...video.progress,
                  positionSeconds: position,
                  completed,
                },
              }
            : video,
        ),
      })
    }
  }

  if (loading) {
    return <PageState>Preparing your lesson…</PageState>
  }

  if (error || !data || !currentVideo) {
    return <PageState>{error || 'Lesson not found'}</PageState>
  }

  const previousVideo = currentIndex > 0 ? data.videos[currentIndex - 1] : null
  const nextVideo =
    currentIndex < data.videos.length - 1 ? data.videos[currentIndex + 1] : null

  return (
    <main className="player-page">
      <section className="player-main">
        <div className="video-shell">
          {playbackUrl ? (
            <video
              ref={player}
              controls
              src={playbackUrl}
              onLoadedMetadata={() => {
                if (player.current) {
                  player.current.currentTime =
                    currentVideo.progress.positionSeconds
                }
              }}
              onPause={() => void persistProgress(false)}
              onEnded={() => void persistProgress(true)}
              onTimeUpdate={() => {
                const currentTime = Math.round(player.current?.currentTime ?? 0)
                if (currentTime - lastSavedAt.current >= 12) {
                  void persistProgress(false)
                }
              }}
              onError={() => {
                if (playbackRetries.current === 0) {
                  playbackRetries.current += 1
                  getPlayback(videoId)
                    .then((playback) => setPlaybackUrl(playback.url))
                    .catch(() =>
                      setPlaybackError('Could not refresh the playback URL.'),
                    )
                  return
                }
                setPlaybackError('Video playback is unavailable.')
              }}
            />
          ) : (
            <div className="video-placeholder">
              <span>FA</span>
              <p>{playbackError || 'Loading video…'}</p>
            </div>
          )}
        </div>
        {playbackError ? (
          <p className="player-notice">{playbackError}</p>
        ) : null}
        <div className="player-heading">
          <div>
            <span className="eyebrow">Lesson {currentIndex + 1}</span>
            <h1>{currentVideo.name}</h1>
            <p>{data.course.name}</p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            disabled={saving || currentVideo.progress.completed}
            onClick={() => void persistProgress(true)}
          >
            {currentVideo.progress.completed ? 'Completed' : 'Mark complete'}
          </button>
        </div>
        <div className="player-navigation">
          {previousVideo ? (
            <Link to={`/courses/${slug}/content/${previousVideo.id}`}>
              ← Previous lesson
            </Link>
          ) : (
            <span />
          )}
          {nextVideo ? (
            <Link to={`/courses/${slug}/content/${nextVideo.id}`}>
              Next lesson →
            </Link>
          ) : (
            <Link to={`/courses/${slug}/content`}>Back to course</Link>
          )}
        </div>
      </section>
      <aside className="player-sidebar">
        <Link className="back-link" to={`/courses/${slug}/content`}>
          ← Course overview
        </Link>
        <h2>{data.course.name}</h2>
        <div className="sidebar-lessons">
          {data.videos.map((video, index) => (
            <Link
              className={video.id === currentVideo.id ? 'is-active' : ''}
              to={`/courses/${slug}/content/${video.id}`}
              key={video.id}
            >
              <span>{video.progress.completed ? '✓' : index + 1}</span>
              {video.name}
            </Link>
          ))}
        </div>
      </aside>
    </main>
  )
}
