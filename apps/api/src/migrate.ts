import { Kysely, Migrator, FileMigrationProvider } from 'kysely'
import { PostgresJSDialect } from 'kysely-postgres-js'
import postgres from 'postgres'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Database } from './schema.js'

const client = postgres(process.env.DATABASE_URL!)

const db = new Kysely<Database>({
  dialect: new PostgresJSDialect({ postgres: client }),
})

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'migrations',
    ),
  }),
})

const { error, results } = await migrator.migrateToLatest()

results?.forEach(r => {
  if (r.status === 'Success') console.log(`Applied:  ${r.migrationName}`)
  if (r.status === 'Error')   console.error(`Failed:   ${r.migrationName}`)
})

if (error) {
  console.error('Migration failed:', error)
  process.exit(1)
}

await db.destroy()
