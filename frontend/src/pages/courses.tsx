import { useCallback, useState } from 'react'

import { CourseCard, SectionHeading } from '../components/ui'
import { listCourses } from '../lib/api'
import { useLoad } from '../lib/use-load'

export function CoursesPage() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const load = useCallback(() => listCourses(search), [search])
  const { data, error, loading } = useLoad(load)

  return (
    <main className="page-shell">
      <section className="page-hero compact-hero">
        <SectionHeading
          eyebrow="Course library"
          title="Practical courses, clear outcomes."
          copy="Browse every published course and inspect the full lesson list before you start."
        />
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault()
            setSearch(query)
          }}
        >
          <label htmlFor="course-search">Search courses</label>
          <div>
            <input
              id="course-search"
              value={query}
              placeholder="Try Hydra Facial"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="button" type="submit">
              Search
            </button>
          </div>
        </form>
      </section>
      <section className="section-inner course-list-section">
        {loading ? <p className="muted">Loading courses…</p> : null}
        {error ? <p className="inline-error">{error}</p> : null}
        {data?.courses.length === 0 ? (
          <div className="empty-card">
            <h2>No courses found</h2>
            <p>Try a shorter search or browse the full course library.</p>
          </div>
        ) : null}
        <div className="course-grid">
          {data?.courses.map((course) => (
            <CourseCard course={course} key={course.id} />
          ))}
        </div>
      </section>
    </main>
  )
}
