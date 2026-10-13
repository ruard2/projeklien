import { db } from "./db";

/**
 * Tempo-beperking wat oor verskeie bediener-instansies werk (gestoor in Postgres).
 * Gee true as die aksie toegelaat word (en teken dit aan).
 */
export async function allow(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000);
  const count = await db.rateEvent.count({ where: { bucket, createdAt: { gte: since } } });
  if (count >= limit) return false;
  await db.rateEvent.create({ data: { bucket } });
  // Ruim af en toe ou rekords op.
  if (Math.random() < 0.01) {
    await db.rateEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * 86400_000) } } });
  }
  return true;
}
