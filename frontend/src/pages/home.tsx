import { useCallback } from 'react'
import { Link } from 'react-router-dom'

import { CourseCard, SectionHeading } from '../components/ui'
import { listCourses } from '../lib/api'
import { useLoad } from '../lib/use-load'

const learningSteps = [
  {
    number: '01',
    title: 'Choose your course',
    copy: 'Compare the syllabus, lesson count, and learning outcomes.',
  },
  {
    number: '02',
    title: 'Learn in your own time',
    copy: 'Watch each practical lesson on your phone or laptop.',
  },
  {
    number: '03',
    title: 'Continue where you stopped',
    copy: 'Your progress stays saved across every lesson.',
  },
]

export function HomePage() {
  const load = useCallback(() => listCourses(), [])
  const { data, error } = useLoad(load)
  const featuredCourses = data?.courses.slice(0, 2) ?? []

  return (
    <main>
      <section className="hero section-pad">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Feminy Academy · Online</span>
            <h1>Beauty ka hunar seekhiye, apni pace par.</h1>
            <p className="hero-lede">
              Practical beauty courses in simple Hindi and Hinglish. Clear
              lessons, useful techniques, and saved progress from start to
              finish.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/courses">
                Explore courses
              </Link>
              <Link className="button button-secondary" to="/login">
                Continue learning
              </Link>
            </div>
            <div className="hero-notes">
              <span>Hindi / Hinglish</span>
              <span>Self-paced lessons</span>
              <span>Progress saved</span>
            </div>
          </div>
          <div className="hero-art" aria-label="Feminy Academy course preview">
            <div className="hero-art-top">
              <span>Course library</span>
              <span>Online</span>
            </div>
            <div className="hero-monogram">F</div>
            <div className="hero-art-bottom">
              <strong>Practical skills.</strong>
              <span>Thoughtful guidance.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Course benefits">
        <div>
          <strong>18</strong>
          <span>Practical lessons</span>
        </div>
        <div>
          <strong>2</strong>
          <span>Focused courses</span>
        </div>
        <div>
          <strong>1</strong>
          <span>Learning library</span>
        </div>
        <div>
          <strong>∞</strong>
          <span>Learn at your pace</span>
        </div>
      </section>

      <section className="section-pad soft-section">
        <div className="section-inner">
          <SectionHeading
            eyebrow="A clear way to learn"
            title="Technique samajhiye, sirf steps yaad nahi."
            copy="Each course follows a practical sequence so you always know what to learn next and why it matters."
          />
          <div className="principle-grid">
            <article>
              <span>01</span>
              <h3>Structured lessons</h3>
              <p>Move from setup and safety to the full practical protocol.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Useful details</h3>
              <p>
                Learn tools, products, common mistakes, and client aftercare.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>Visible progress</h3>
              <p>See what is complete and continue from your last lesson.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section-pad dark-section">
        <div className="section-inner teacher-grid">
          <div>
            <span className="eyebrow eyebrow-gold">Your guide</span>
            <h2>Practical beauty education, explained simply.</h2>
            <p>
              Feminy Academy turns real salon workflows into focused online
              lessons. The emphasis stays on hygiene, technique, confident
              service, and the details a learner can use in practice.
            </p>
            <Link className="button button-light" to="/courses">
              See the curriculum
            </Link>
          </div>
          <div className="teacher-card" aria-hidden="true">
            <div className="teacher-card-mark">FA</div>
            <div>
              <strong>Sunita Rathee</strong>
              <span>Instructor · Feminy Academy</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="section-inner">
          <SectionHeading
            eyebrow="Simple learning flow"
            title="Teen seedhe steps"
          />
          <div className="steps-grid">
            {learningSteps.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad courses-section">
        <div className="section-inner">
          <SectionHeading
            eyebrow="Our courses"
            title="Aap kya seekhna chahti hain?"
            copy="Start with a focused foundation or go deeper into Hydra Facial technique."
          />
          {error ? <p className="inline-error">{error}</p> : null}
          <div className="course-grid">
            {featuredCourses.map((course) => (
              <CourseCard course={course} key={course.id} />
            ))}
          </div>
          <div className="section-action">
            <Link className="button button-secondary" to="/courses">
              Browse all courses
            </Link>
          </div>
        </div>
      </section>

      <section className="section-pad final-cta">
        <div className="section-inner final-cta-inner">
          <span className="eyebrow">Start when you are ready</span>
          <h2>Apni next practical skill aaj se shuru kijiye.</h2>
          <p>
            Create an account, choose a course, and keep every lesson in one
            place.
          </p>
          <Link className="button" to="/signup">
            Create your account
          </Link>
        </div>
      </section>
    </main>
  )
}
