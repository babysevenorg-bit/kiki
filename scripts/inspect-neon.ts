// Inspect the existing Neon database BEFORE doing anything destructive.
// Uses the raw `pg` driver so we don't depend on the Prisma schema (which
// is currently set to SQLite and would block the connection).
import { Client } from "pg"

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
  if (!url) {
    console.error("[kiki:inspect] DATABASE_URL / DATABASE_URL_UNPOOLED not set")
    process.exit(1)
  }
  const masked = url.replace(/:[^:@]+@/, ":***@")
  console.log(`[kiki:inspect] connecting to Neon…`)
  console.log(`[kiki:inspect] target: ${masked}`)

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 15_000 })
  await client.connect()

  // 1. List every base table in the public schema
  const { rows } = await client.query<{
    table_name: string
  }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `)

  if (rows.length === 0) {
    console.log("[kiki:inspect] result: no tables exist — empty database, safe to push schema")
    await client.end()
    return
  }

  console.log(`[kiki:inspect] found ${rows.length} existing tables:`)
  let totalRows = 0
  for (const r of rows) {
    const safe = r.table_name.replace(/[^a-zA-Z0-9_]/g, "")
    try {
      const c = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "public"."${safe}";`,
      )
      const count = Number(c.rows[0]?.count ?? 0)
      totalRows += count
      console.log(`  - ${r.table_name}: ${count} rows`)
    } catch (e) {
      console.log(`  - ${r.table_name}: (count failed — ${String((e as Error).message).split("\n")[0]})`)
    }
  }
  if (totalRows > 0) {
    console.log(`[kiki:inspect] WARNING: ${totalRows} rows of existing data present — review before running db:push`)
  } else {
    console.log(`[kiki:inspect] all tables empty — safe to seed`)
  }

  await client.end()
}

main().catch((e) => {
  console.error("[kiki:inspect] failed:", e?.message ?? String(e).split("\n")[0])
  process.exit(1)
})
