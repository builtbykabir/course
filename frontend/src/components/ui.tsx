import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { Course } from '../lib/api'
import { formatPrice } from '../lib/api'

export function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string
  title: string
  copy?: string
}) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  )
}

export function CourseCard({ course }: { course: Course }) {
  return (
    <article className="course-card">
      <div className="course-card-art" aria-hidden="true">
        <span>{course.metadata.category ?? 'Online course'}</span>
        <strong>{course.metadata.lessonCount ?? '—'}</strong>
        <small>lessons</small>
      </div>
      <div className="course-card-body">
        <div className="course-card-meta">
          <span>{course.metadata.format ?? 'Self-paced'}</span>
          <strong>{formatPrice(course.pricePaise, course.currency)}</strong>
        </div>
        <h3>{course.name}</h3>
        <p>{course.description}</p>
        <div className="course-card-facts">
          <span>{course.metadata.durationLabel ?? 'Self-paced'}</span>
          <span>{course.metadata.language ?? 'Hindi / Hinglish'}</span>
        </div>
        <Link className="text-link" to={`/courses/${course.slug}`}>
          View course <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  )
}

export function PageState({ children }: { children: ReactNode }) {
  return (
    <main className="page-shell">
      <div className="state-card">{children}</div>
    </main>
  )
}

export function ProgressBar({ value }: { value: number }) {
  const boundedValue = Math.max(0, Math.min(100, value))
  return (
    <div
      className="progress-track"
      aria-label={`${Math.round(boundedValue)}% complete`}
    >
      <span style={{ width: `${boundedValue}%` }} />
    </div>
  )
}
