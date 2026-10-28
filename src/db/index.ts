import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Pool, type PoolClient } from 'pg';

export interface SqlQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DbTransactionClient {
  query<T = Record<string, unknown>>(
    sqlText: string,
    params?: unknown[]
  ): Promise<SqlQueryResult<T>>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidUuid(value: string, label = 'UUID'): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${label}: "${value}"`);
  }
}

// Singleton references across Next.js HMR / workers
const globalForDb = globalThis as unknown as {
  __boPgPool?: Pool;
  __boPglite?: PGlite;
  __boInitializedPromise?: Promise<void>;
  __boMutex?: Promise<void>;
};

function getMigrationSql(): string {
  const migrationPath = path.join(
    process.cwd(),
    'src',
    'db',
    'migrations',
    '0001_initial_schema_and_rls.sql'
  );
  return fs.readFileSync(migrationPath, 'utf-8');
}

async function getPgliteInstance(): Promise<PGlite> {
  if (!globalForDb.__boPglite) {
    const dataDir = process.env.PGLITE_DATA_DIR || 'memory://barraonline-pg16';
    globalForDb.__boPglite = new PGlite(dataDir);
  }
  return globalForDb.__boPglite;
}

function getPgPool(): Pool {
  if (!globalForDb.__boPgPool) {
    globalForDb.__boPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalForDb.__boPgPool;
}

/**
 * Serializes transactions when running on embedded single-connection PGlite
 * so concurrent promises execute atomic PostgreSQL transactions deterministically
 * without interleaving `BEGIN`/`COMMIT` on the same wire.
 */
async function withPgliteLock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = globalForDb.__boMutex ?? Promise.resolve();
  let release!: () => void;
  globalForDb.__boMutex = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function ensureDatabaseInitialized(): Promise<void> {
  if (!globalForDb.__boInitializedPromise) {
    globalForDb.__boInitializedPromise = (async () => {
      const migrationSql = getMigrationSql();
      if (process.env.DATABASE_URL) {
        const pool = getPgPool();
        await pool.query(migrationSql);
      } else {
        const pglite = await getPgliteInstance();
        await pglite.exec(migrationSql);
      }
    })();
  }
  return globalForDb.__boInitializedPromise;
}

async function runRawTransaction<T>(
  setupSql: (tx: DbTransactionClient) => Promise<void>,
  fn: (tx: DbTransactionClient) => Promise<T>
): Promise<T> {
  await ensureDatabaseInitialized();

  if (process.env.DATABASE_URL) {
    const pool = getPgPool();
    const client: PoolClient = await pool.connect();
    const txClient: DbTransactionClient = {
      async query<R = Record<string, unknown>>(sqlText: string, params: unknown[] = []) {
        const res = await client.query(sqlText, params);
        return {
          rows: res.rows as R[],
          rowCount: res.rowCount ?? res.rows.length,
        };
      },
    };

    try {
      await client.query('BEGIN');
      await setupSql(txClient);
      const result = await fn(txClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  const pglite = await getPgliteInstance();
  return withPgliteLock(async () => {
    const txClient: DbTransactionClient = {
      async query<R = Record<string, unknown>>(sqlText: string, params: unknown[] = []) {
        const res = await pglite.query<R>(sqlText, params);
        return {
          rows: res.rows,
          rowCount: res.affectedRows ?? res.rows.length,
        };
      },
    };

    try {
      await pglite.exec('BEGIN;');
      await setupSql(txClient);
      const result = await fn(txClient);
      await pglite.exec('COMMIT;');
      return result;
    } catch (error) {
      await pglite.exec('ROLLBACK;').catch(() => undefined);
      throw error;
    }
  });
}

/**
 * Ejecuta una transacción PostgreSQL estrictamente aislada al `tenantId` indicado.
 * - Activa `SET LOCAL ROLE app_runtime_user` (rol sin BYPASSRLS).
 * - Fija `app.current_tenant_id = tenantId` y `app.is_superadmin = false` localmente a la transacción.
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: DbTransactionClient) => Promise<T>
): Promise<T> {
  assertValidUuid(tenantId, 'tenantId');

  return runRawTransaction(
    async (tx) => {
      await tx.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
      await tx.query(`SELECT set_config('app.is_superadmin', 'false', true)`);
      await tx.query(`SET LOCAL ROLE app_runtime_user`);
    },
    fn
  );
}

/**
 * Ejecuta una transacción con privilegios globales de Superadministración.
 * - Activa `SET LOCAL ROLE app_runtime_user`.
 * - Fija `app.is_superadmin = true`.
 */
export async function withSuperadminContext<T>(
  fn: (tx: DbTransactionClient) => Promise<T>
): Promise<T> {
  return runRawTransaction(
    async (tx) => {
      await tx.query(`SELECT set_config('app.current_tenant_id', '', true)`);
      await tx.query(`SELECT set_config('app.is_superadmin', 'true', true)`);
      await tx.query(`SET LOCAL ROLE app_runtime_user`);
    },
    fn
  );
}

/**
 * Ejecuta una transacción bajo `app_runtime_user` sin contexto de tenant ni superadmin.
 * Útil para resolver el tenant por slug en la tabla pública `tenants` o para probar
 * que RLS rechaza cualquier acceso a tablas de negocio cuando no hay tenant activo.
 */
export async function withAnonymousRlsContext<T>(
  fn: (tx: DbTransactionClient) => Promise<T>
): Promise<T> {
  return runRawTransaction(
    async (tx) => {
      await tx.query(`SELECT set_config('app.current_tenant_id', '', true)`);
      await tx.query(`SELECT set_config('app.is_superadmin', 'false', true)`);
      await tx.query(`SET LOCAL ROLE app_runtime_user`);
    },
    fn
  );
}
