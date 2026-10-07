// Seed the Kiki backend with a starter catalog of HD wallpapers from Unsplash.
// Run with: bun run /home/z/my-project/scripts/seed.ts
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

type C = {
  name: string
  slug: string
  icon: string
  accent: string
}

const categories: C[] = [
  { name: "Nature", slug: "nature", icon: "🌿", accent: "#10b981" },
  { name: "Abstract", slug: "abstract", icon: "🎨", accent: "#a855f7" },
  { name: "Minimal", slug: "minimal", icon: "⬜", accent: "#64748b" },
  { name: "City", slug: "city", icon: "🏙️", accent: "#f59e0b" },
  { name: "Anime", slug: "anime", icon: "🌸", accent: "#ec4899" },
  { name: "Space", slug: "space", icon: "🚀", accent: "#6366f1" },
  { name: "Animals", slug: "animals", icon: "🐯", accent: "#ef4444" },
  { name: "Dark", slug: "dark", icon: "🌙", accent: "#1e293b" },
]

// Real HD Unsplash photos in portrait orientation. Each URL is the
// high-resolution version. The "thumb" version uses Unsplash's URL params
// to deliver a smaller preview image for the RN app grid.
const wallpapers: Array<{
  title: string
  category: string
  tags: string[]
  unsplash: string
  resolution: string
  fileSizeKb: number
  accentColor: string
}> = [
  // Nature
  {
    title: "Misty Mountain Sunrise",
    category: "Nature",
    tags: ["mountains", "fog", "sunrise", "landscape"],
    unsplash: "photo-1506905925346-21b8a3c9e024",
    resolution: "2400x3200",
    fileSizeKb: 1840,
    accentColor: "#0f172a",
  },
  {
    title: "Northern Lights",
    category: "Nature",
    tags: ["aurora", "night", "sky", "stars"],
    unsplash: "photo-1483347750961-5b6e6fda6619",
    resolution: "2160x2880",
    fileSizeKb: 2210,
    accentColor: "#0a0a2a",
  },
  {
    title: "Emerald Forest",
    category: "Nature",
    tags: ["forest", "trees", "green", "depth"],
    unsplash: "photo-1448375240586-882707db888b",
    resolution: "2400x3200",
    fileSizeKb: 1620,
    accentColor: "#052e16",
  },
  // Abstract
  {
    title: "Liquid Chrome",
    category: "Abstract",
    tags: ["metal", "fluid", "macro", "shiny"],
    unsplash: "photo-1550859364-e6c5b8a8a3a4",
    resolution: "2160x2880",
    fileSizeKb: 1950,
    accentColor: "#1f2937",
  },
  {
    title: "Pastel Smoke",
    category: "Abstract",
    tags: ["pastel", "soft", "smoke", "gradient"],
    unsplash: "photo-1557682250-e14bd8e3b758",
    resolution: "2160x2880",
    fileSizeKb: 1450,
    accentColor: "#fbcfe8",
  },
  {
    title: "Neon Wave",
    category: "Abstract",
    tags: ["neon", "wave", "purple", "glow"],
    unsplash: "photo-1620656230680-1d7e8b3c1f7b",
    resolution: "2160x2880",
    fileSizeKb: 1700,
    accentColor: "#a855f7",
  },
  // Minimal
  {
    title: "Soft Sand Dunes",
    category: "Minimal",
    tags: ["sand", "desert", "minimal", "warm"],
    unsplash: "photo-1500382017468-9049d7f424f2",
    resolution: "2400x3200",
    fileSizeKb: 1180,
    accentColor: "#fef3c7",
  },
  {
    title: "Concrete Calm",
    category: "Minimal",
    tags: ["concrete", "gray", "wall", "texture"],
    unsplash: "photo-1517649253986-5e5772b4fb44",
    resolution: "2160x2880",
    fileSizeKb: 1340,
    accentColor: "#e5e7eb",
  },
  // City
  {
    title: "Tokyo at Night",
    category: "City",
    tags: ["tokyo", "neon", "rain", "street"],
    unsplash: "photo-1542051841857-5f9005e5aa5b",
    resolution: "2160x2880",
    fileSizeKb: 2150,
    accentColor: "#1e1b4b",
  },
  {
    title: "Manhattan Mist",
    category: "City",
    tags: ["nyc", "skyline", "fog", "sky"],
    unsplash: "photo-1496588152823-86ff7695e1e9",
    resolution: "2400x3200",
    fileSizeKb: 2050,
    accentColor: "#0c0a09",
  },
  // Anime / illustrated
  {
    title: "Studio Hills",
    category: "Anime",
    tags: ["illustration", "hills", "anime", "sky"],
    unsplash: "photo-1518709268-7715a0b4ab8b",
    resolution: "2160x2880",
    fileSizeKb: 1280,
    accentColor: "#fde68a",
  },
  {
    title: "Cherry Bloom",
    category: "Anime",
    tags: ["sakura", "pink", "bloom", "soft"],
    unsplash: "photo-1522383228982-5652d4f9717d",
    resolution: "2160x2880",
    fileSizeKb: 1490,
    accentColor: "#f9a8d4",
  },
  // Space
  {
    title: "Orion Arm",
    category: "Space",
    tags: ["galaxy", "stars", "milkyway", "deep"],
    unsplash: "photo-1462331944005-f4f60f214e0a",
    resolution: "2400x3200",
    fileSizeKb: 2280,
    accentColor: "#020617",
  },
  {
    title: "Planet Horizon",
    category: "Space",
    tags: ["planet", "horizon", "space", "blue"],
    unsplash: "photo-1614728265470-cf6c81c6fdba",
    resolution: "2160x2880",
    fileSizeKb: 1830,
    accentColor: "#0c1c2e",
  },
  // Animals
  {
    title: "Calm Fox",
    category: "Animals",
    tags: ["fox", "wildlife", "snow", "calm"],
    unsplash: "photo-1474518192440-0eb7c1e9f48d",
    resolution: "2160x2880",
    fileSizeKb: 1710,
    accentColor: "#7c2d12",
  },
  {
    title: "Tiger Watch",
    category: "Animals",
    tags: ["tiger", "wildlife", "bigcat", "stare"],
    unsplash: "photo-1561731216-c3b4d4c0d1a4",
    resolution: "2160x2880",
    fileSizeKb: 2090,
    accentColor: "#1c1917",
  },
  // Dark
  {
    title: "Black Sand",
    category: "Dark",
    tags: ["black", "texture", "grain", "matte"],
    unsplash: "photo-1518770670839-c2e3b4e7c3e8",
    resolution: "2160x2880",
    fileSizeKb: 1190,
    accentColor: "#0a0a0a",
  },
  {
    title: "Ink Bloom",
    category: "Dark",
    tags: ["ink", "abstract", "dark", "fluid"],
    unsplash: "photo-1574020288-5b76c3d57d9e",
    resolution: "2160x2880",
    fileSizeKb: 1620,
    accentColor: "#111827",
  },
]

function makeImageUrl(unsplash: string, w = 1080, q = 80) {
  return `https://images.unsplash.com/${unsplash}?w=${w}&q=${q}&fm=jpg&fit=crop`
}

function makeThumbUrl(unsplash: string) {
  return `https://images.unsplash.com/${unsplash}?w=420&q=70&fm=jpg&fit=crop`
}

async function main() {
  console.log("[kiki:seed] starting")

  // Categories — INSERT-ONLY. If a category with the same slug already exists
  // (e.g. the user customized the icon/accent on Neon), we leave it untouched.
  let categoriesCreated = 0
  let categoriesSkipped = 0
  for (const c of categories) {
    const existing = await db.category.findUnique({ where: { slug: c.slug } })
    if (existing) {
      categoriesSkipped++
      continue
    }
    await db.category.create({
      data: { ...c, count: 0, active: true },
    })
    categoriesCreated++
  }
  console.log(
    `[kiki:seed] categories: created=${categoriesCreated} skipped=${categoriesSkipped}`,
  )

  // Wallpapers — INSERT-ONLY. Existing rows are never overwritten so that
  // manual edits on Neon (or a previous seed run with custom titles) survive
  // a re-run of this script.
  let created = 0
  let skipped = 0
  for (let i = 0; i < wallpapers.length; i++) {
    const w = wallpapers[i]
    // Use title as the natural key (deterministic re-run)
    const existing = await db.wallpaper.findFirst({ where: { title: w.title } })
    if (existing) {
      skipped++
      continue
    }
    const imageUrl = makeImageUrl(w.unsplash)
    const thumbUrl = makeThumbUrl(w.unsplash)
    await db.wallpaper.create({
      data: {
        title: w.title,
        imageUrl,
        thumbUrl,
        category: w.category,
        tags: JSON.stringify(w.tags),
        resolution: w.resolution,
        fileSizeKb: w.fileSizeKb,
        orientation: "portrait",
        accentColor: w.accentColor,
        featured: i % 4 === 0, // every 4th is featured
        active: true,
        source: "unsplash",
      },
    })
    created++
  }

  // Recompute category counts (safe — just reflects current state)
  for (const c of categories) {
    const count = await db.wallpaper.count({ where: { category: c.name, active: true } })
    await db.category.update({
      where: { slug: c.slug },
      data: { count },
    })
  }

  console.log(
    `[kiki:seed] done. created=${created} skipped=${skipped} (already existed) total=${wallpapers.length}`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
