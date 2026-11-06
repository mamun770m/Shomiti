import { syncAuthenticDatasetToPostgres } from './dataIntelligence.ts';

/**
 * Ensures the PostgreSQL database is populated exclusively with the authentic
 * 12 members and 1,152 monthly records from "Shomiti Hishab English (1).xlsx"
 * (and purges any legacy demo data if present).
 * Uses `forceResync = false` so concurrent requests share a single verification/sync mutex.
 */
export async function ensureSeeded() {
  try {
    const result = await syncAuthenticDatasetToPostgres(false);
    return { seeded: result.status === 'APPROVED_AND_IMPORTED', status: result.status };
  } catch (error) {
    console.error('Error in ensureSeeded:', error);
    throw new Error('Failed to synchronize authentic Hilful Fuzul dataset.', { cause: error });
  }
}
