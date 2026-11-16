import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageState, SectionHeading } from '../components/ui'
import { formatDuration, formatPrice, getCourse } from '../lib/api'
import { useLoad } from '../lib/use-load'

export function CourseDetailPage() {
  const { slug = '' } = useParams()
  const load = useCallback(() => getCourse(slug), [slug])
  const { data, error, loading } = useLoad(load)

  if (loading) {
    return <PageState>Loading course…</PageState>
  }

  if (error || !data) {
    return <PageState>{error || 'Course not found'}</PageState>
  }

  const { course, videos, owned } = data
  const metadata = course.metadata
  const totalSeconds = videos.reduce(
    (total, lesson) => total + (lesson.durationSeconds ?? 0),
    0,
  )

  return (
    <main>
      <section className="course-hero section-pad">
        <div className="course-hero-grid">
          <div>
            <span className="eyebrow">
              {metadata.eyebrow ?? 'Online course'}
            </span>
            <h1>{course.name}</h1>
            <p className="hero-lede">{course.description}</p>
            <div className="course-fact-row">
              <span>{metadata.language ?? 'Hindi / Hinglish'}</span>
              <span>
                {metadata.durationLabel ?? formatDuration(totalSeconds)}
              </span>
              <span>{videos.length} lessons</span>
            </div>
          </div>
          <aside className="enrol-card">
            <span className="eyebrow">Course access</span>
            <strong className="price">
              {formatPrice(course.pricePaise, course.currency)}
            </strong>
            <p>One course, one ordered learning path, and saved progress.</p>
            {owned ? (
              <Link className="button" to={`/courses/${course.slug}/content`}>
                Continue course
              </Link>
            ) : (
              <Link className="button" to="/login">
                Sign in to access
              </Link>
            )}
            <small>
              Online payment is not connected yet. Admins can grant access for
              accounts with access granted by an administrator.
            </small>
          </aside>
        </div>
      </section>

      <section className="section-pad soft-section">
        <div className="section-inner">
          <SectionHeading
            eyebrow="Who it is for"
            title="A course built around practical work."
          />
          <div className="audience-grid">
            {metadata.audience?.map((item, index) => (
              <article key={item.title}>
                <span>0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="section-inner detail-two-column">
          <div>
            <SectionHeading eyebrow="Outcomes" title="Course ke baad" />
            <ol className="outcome-list">
              {metadata.outcomes?.map((outcome, index) => (
                <li key={outcome}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {outcome}
                </li>
              ))}
            </ol>
          </div>
          <div className="feature-panel">
            <span className="eyebrow eyebrow-gold">Included</span>
            <h2>What you get</h2>
            <ul className="check-list">
              {metadata.features?.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section-pad syllabus-section">
        <div className="section-inner">
          <SectionHeading
            eyebrow="Full syllabus"
            title={`${videos.length} lessons, in a clear order.`}
            copy="Lesson videos unlock after access is granted and stream from private storage."
          />
          <div className="syllabus-list">
            {videos.map((video, index) => (
              <div key={video.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{video.name}</strong>
                <small>{formatDuration(video.durationSeconds)}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {metadata.faq?.length ? (
        <section className="section-pad">
          <div className="section-inner faq-wrap">
            <SectionHeading eyebrow="Questions" title="Zaroori sawaal" />
            <div className="faq-list">
              {metadata.faq.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}
