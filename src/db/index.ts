import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _postgresPoolPatched: boolean | undefined;
}

const isTransientConnectionError = (err: any): boolean => {
  const msg = String(err?.message || err?.cause?.message || '').toLowerCase();
  const code = String(err?.code || err?.cause?.code || '');
  return (
    msg.includes('timeout exceeded when trying to connect') ||
    msg.includes('connection terminated') ||
    msg.includes('connection reset') ||
    msg.includes('client has encountered a connection error') ||
    msg.includes('terminating connection') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('epipe') ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03' ||
    code === '08006' ||
    code === '08003' ||
    code === '08001'
  );
};

export const createPool = () => {
  if (!global._postgresPool) {
    // Connect both the AI Studio Dev Preview (ais-dev-...) and Published App (ais-pre-...)
    // to the exact same live PostgreSQL database ('cloud_sql_production_database') on this Cloud SQL instance
    // so any change made on the Published link or in Dev updates everywhere automatically in real time.
    const targetDatabase =
      process.env.SQL_HOST && process.env.SQL_DB_NAME === 'cloud_sql_development_database'
        ? 'cloud_sql_production_database'
        : process.env.SQL_DB_NAME;

    const poolInstance = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: targetDatabase,
      max: 20,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000,
    });

    poolInstance.on('error', () => {
      // Cloud SQL periodically recycles idle connections; pg.Pool automatically reconnects on next query.
    });

    // Patch pool.query once to transparently retry transient connection / cold-start timeout errors
    if (!global._postgresPoolPatched) {
      const origQuery = poolInstance.query.bind(poolInstance) as (...args: any[]) => Promise<any>;
      (poolInstance as any).query = async (...args: any[]) => {
        // Only wrap promise-style calls (when last arg is not a callback function)
        if (typeof args[args.length - 1] === 'function') {
          return origQuery(...args);
        }
        let lastErr: any;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await origQuery(...args);
          } catch (err: any) {
            lastErr = err;
            if (attempt < 2 && isTransientConnectionError(err)) {
              await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
              continue;
            }
            throw err;
          }
        }
        throw lastErr;
      };
      global._postgresPoolPatched = true;
    }

    global._postgresPool = poolInstance;
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
