import postgres from 'postgres'
import { Kysely } from 'kysely'
import { PostgresJSDialect } from 'kysely-postgres-js'
import { Database } from './schema.js'

const client = postgres(process.env.DATABASE_URL!)

export const db = new Kysely<Database>({
  dialect: new PostgresJSDialect({ postgres: client }),
})
