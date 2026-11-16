import { db, pool } from '../db/index.js'
import { course, video } from '../db/schema.js'

type DemoLesson = [id: string, name: string, durationMinutes: number]

type DemoCourse = {
  slug: string
  name: string
  description: string
  pricePaise: number
  currency: string
  status: 'published'
  metadata: Record<string, unknown>
  videos: DemoLesson[]
}

const demoCourses: DemoCourse[] = [
  {
    slug: 'hydra-facial',
    name: 'Online Hydra Facial Course',
    description:
      'Skin consultation, machine setup, treatment steps, aftercare, and salon pricing in simple Hindi and Hinglish.',
    pricePaise: 300_000,
    currency: 'INR',
    status: 'published',
    metadata: {
      eyebrow: 'ONLINE COURSE · HINDI MEIN',
      category: 'Skin & cosmetology',
      format: 'Self-paced video course',
      language: 'Hindi / Hinglish',
      durationLabel: '4 hr 21 min',
      lessonCount: 12,
      audience: [
        {
          title: 'Parlour owners',
          description: 'Add a structured Hydra Facial service to your menu.',
        },
        {
          title: 'Working artists',
          description: 'Build confidence with machine settings and protocols.',
        },
        {
          title: 'Beginners',
          description: 'Start with skin basics, hygiene, and guided technique.',
        },
      ],
      outcomes: [
        'Set up and maintain a Hydra Facial machine',
        'Choose a protocol for common skin types',
        'Follow a complete treatment sequence',
        'Price treatments and explain aftercare',
      ],
      features: [
        '12 practical video lessons',
        'Skin consultation and safety guidance',
        'Treatment, aftercare, and pricing lessons',
        'Saved learning progress',
      ],
      faq: [
        {
          question: 'Kya mujhe Hydra Facial machine chahiye?',
          answer:
            'Nahi. Aap pehle process aur technique samajh sakti hain, phir apne kaam ke hisaab se machine chun sakti hain.',
        },
        {
          question: 'Course phone pe chalega?',
          answer: 'Haan, course phone aur laptop dono par chalta hai.',
        },
        {
          question: 'Bilkul beginner hoon, samajh aayega?',
          answer:
            'Haan. Lessons basics se shuru hote hain aur simple Hindi aur Hinglish mein hain.',
        },
      ],
    },
    videos: [
      [
        '81000000-0000-4000-8000-000000000001',
        'Hydra Facial machine ke parts aur attachments',
        18,
      ],
      [
        '81000000-0000-4000-8000-000000000002',
        'Suction power, tips aur maintenance',
        22,
      ],
      [
        '81000000-0000-4000-8000-000000000003',
        'Serums: Salicylic, Glycolic aur Hyaluronic acid',
        25,
      ],
      [
        '81000000-0000-4000-8000-000000000004',
        'Client skin assessment aur contraindications',
        20,
      ],
      [
        '81000000-0000-4000-8000-000000000005',
        'Cleansing aur double-cleansing protocol',
        15,
      ],
      [
        '81000000-0000-4000-8000-000000000006',
        'Exfoliation aur dead skin removal',
        28,
      ],
      [
        '81000000-0000-4000-8000-000000000007',
        'Deep pore cleansing aur extraction',
        30,
      ],
      [
        '81000000-0000-4000-8000-000000000008',
        'Hydration aur serum infusion',
        25,
      ],
      [
        '81000000-0000-4000-8000-000000000009',
        'High-frequency wand aur cooling probe',
        20,
      ],
      [
        '81000000-0000-4000-8000-000000000010',
        'Sheet masks aur post-care treatment',
        18,
      ],
      [
        '81000000-0000-4000-8000-000000000011',
        'Client pricing aur treatment packages',
        24,
      ],
      [
        '81000000-0000-4000-8000-000000000012',
        'Aftercare guidance aur client retention',
        16,
      ],
    ],
  },
  {
    slug: 'one-day-masterclass',
    name: '1-Day Beauty Masterclass',
    description:
      'A focused introduction to workstation setup, products, practical technique, aftercare, and client pricing.',
    pricePaise: 100_000,
    currency: 'INR',
    status: 'published',
    metadata: {
      eyebrow: 'ONLINE · FOCUSED MASTERCLASS',
      category: 'Beauty foundations',
      format: 'Self-paced video course',
      language: 'Hindi / Hinglish',
      durationLabel: '2 hours',
      lessonCount: 6,
      audience: [
        {
          title: 'Working artists',
          description: 'Refresh one practical skill in a compact format.',
        },
        {
          title: 'Parlour owners',
          description: 'Learn a repeatable setup, service, and pricing flow.',
        },
        {
          title: 'Beginners',
          description: 'Take a guided first step into practical beauty work.',
        },
      ],
      outcomes: [
        'Prepare a clean and efficient workstation',
        'Choose essential tools and products',
        'Follow a practical service sequence',
        'Handle aftercare and client pricing',
      ],
      features: [
        '6 focused video lessons',
        'Workstation and product guidance',
        'Practical protocol and common mistakes',
        'Saved learning progress',
      ],
      faq: [
        {
          question: 'Course kitni der ka hai?',
          answer: 'The six video lessons add up to about two hours.',
        },
        {
          question: 'Course phone pe chalega?',
          answer: 'Haan, course phone aur laptop dono par chalta hai.',
        },
        {
          question: 'Kya pehle se experience chahiye?',
          answer:
            'Nahi. The course starts with workstation and product basics.',
        },
      ],
    },
    videos: [
      [
        '82000000-0000-4000-8000-000000000001',
        'Introduction aur workstation setup',
        10,
      ],
      [
        '82000000-0000-4000-8000-000000000002',
        'Product essentials aur tool setup',
        20,
      ],
      [
        '82000000-0000-4000-8000-000000000003',
        'Complete demonstration aur core protocol',
        35,
      ],
      [
        '82000000-0000-4000-8000-000000000004',
        'Finishing, aftercare aur common mistakes',
        15,
      ],
      [
        '82000000-0000-4000-8000-000000000005',
        'Common questions and troubleshooting',
        30,
      ],
      [
        '82000000-0000-4000-8000-000000000006',
        'Client handoff aur next steps',
        10,
      ],
    ],
  },
]

async function seedDemo() {
  await db.transaction(async (transaction) => {
    for (const demoCourse of demoCourses) {
      const [savedCourse] = await transaction
        .insert(course)
        .values({
          slug: demoCourse.slug,
          name: demoCourse.name,
          description: demoCourse.description,
          pricePaise: demoCourse.pricePaise,
          currency: demoCourse.currency,
          status: demoCourse.status,
          metadata: demoCourse.metadata,
        })
        .onConflictDoUpdate({
          target: course.slug,
          set: {
            name: demoCourse.name,
            description: demoCourse.description,
            pricePaise: demoCourse.pricePaise,
            currency: demoCourse.currency,
            status: demoCourse.status,
            metadata: demoCourse.metadata,
            updatedAt: new Date(),
          },
        })
        .returning({ id: course.id })

      if (!savedCourse) {
        throw new Error(`Could not seed ${demoCourse.slug}`)
      }

      for (const [position, lesson] of demoCourse.videos.entries()) {
        const [id, name, durationMinutes] = lesson

        await transaction
          .insert(video)
          .values({
            id,
            courseId: savedCourse.id,
            name,
            objectKey: `demo/${demoCourse.slug}/${id}.mp4`,
            position,
            durationSeconds: durationMinutes * 60,
          })
          .onConflictDoUpdate({
            target: video.id,
            set: {
              courseId: savedCourse.id,
              name,
              objectKey: `demo/${demoCourse.slug}/${id}.mp4`,
              position,
              durationSeconds: durationMinutes * 60,
              updatedAt: new Date(),
            },
          })
      }
    }
  })

  console.log(`Seeded ${demoCourses.length} courses from the Feminy demo`)
}

seedDemo()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
