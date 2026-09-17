import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { webEnv } from "@/env/web";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

/**
 * Lazy DB. Editor does not need Postgres — projects live in IndexedDB/OPFS.
 * Call only from server routes that require a database.
 */
export function getDb(): Db {
	if (!webEnv.DATABASE_URL) {
		throw new Error(
			"DATABASE_URL is not configured. Editor features work without it; add Postgres when enabling auth/server APIs.",
		);
	}
	if (!_db) {
		const client = postgres(webEnv.DATABASE_URL);
		_db = drizzle(client, { schema });
	}
	return _db;
}

/** Proxy so existing `import { db }` keeps working, but connects only on use. */
export const db = new Proxy({} as Db, {
	get(_target, prop, receiver) {
		const real = getDb();
		const value = Reflect.get(real as object, prop, receiver);
		return typeof value === "function" ? value.bind(real) : value;
	},
});

export * from "./schema";
