import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Ленивое подключение к PostgreSQL.
 *
 * Модуль больше не бросает исключение при импорте: если DATABASE_URL не задана
 * или база недоступна, ошибка появляется только в момент реального запроса
 * (с понятным сообщением), а сборка и страницы без БД продолжают работать.
 */
const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzle?: NodePgDatabase<typeof schema>;
};

function assertDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Добавьте строку подключения PostgreSQL в переменные окружения (см. .env.example)."
    );
  }
  return url;
}

function getPool(): Pool {
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    const url = assertDatabaseUrl();
    globalForDb.__arenaNextJsPostgresqlPool = new Pool({ connectionString: url });
  }
  return globalForDb.__arenaNextJsPostgresqlPool;
}

export const pool: Pool = new Proxy({} as Pool, {
  get(_t, prop, receiver) {
    return Reflect.get(getPool(), prop, receiver);
  },
});

export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_t, prop, receiver) {
      if (!globalForDb.__arenaNextJsDrizzle) {
        globalForDb.__arenaNextJsDrizzle = drizzle(getPool(), { schema });
      }
      return Reflect.get(globalForDb.__arenaNextJsDrizzle, prop, receiver);
    },
  }
);
