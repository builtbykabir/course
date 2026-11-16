# Frontend adaptation notes

The frontend takes its visual direction and course copy from the Feminy Academy
reference site. It uses the same warm ivory and plum character, editorial
headings, compact Hindi and English copy, and course-led page structure. It is
an adaptation for this application's real capabilities, not a page-for-page
copy.

## Kept

- The two online courses, their prices, and their lesson subjects.
- The instructor identity and practical, Hindi and Hinglish teaching tone.
- The broad visual system: plum, ivory, muted gold, serif display type, and
  spacious content sections.
- Course discovery, curriculum previews, self-paced learning, and progress
  tracking.

## Adapted

- The reference course modules are stored as ordered lessons because the
  current data model has courses and videos, but no separate module entity.
- Displayed course durations use the sum of the seeded lesson durations. The
  Hydra Facial course is therefore 4 hours 21 minutes instead of the reference
  site's unsupported 6-hour claim. The 1-Day Masterclass totals 2 hours.
- Enrollment calls to action lead to account creation and the in-app course
  library. Until payment processing is connected, administrators grant course
  access from the admin panel.
- The reference site's live doubt session and certificate steps became a
  troubleshooting lesson and a client-handoff lesson.
- The original portrait and course imagery were not reused because the
  published assets resolve to decorative placeholders. The frontend uses a
  typographic visual treatment instead of inventing photography.

## Left out

- Demo class forms, demo bookings, and demo-class calls to action. This product
  does not offer demo classes.
- WhatsApp enrollment, WhatsApp support, callback forms, and the related lead
  capture funnel.
- The three-month offline course, physical academy information, and location
  claims because the current application is an online video-course platform.
- Live sessions and scheduling because there is no scheduling or live-class
  domain in the backend.
- Certificates and downloads because certificate generation and ownership are
  not implemented.
- Razorpay checkout, refund promises, and payment-policy claims until the
  payment integration is completed.
- Student counts, ratings, Instagram follower counts, years-in-business claims,
  and other unverifiable marketing statistics.
- Contact, terms, privacy, and refund-policy pages that do not yet have approved
  content or a corresponding product flow.
