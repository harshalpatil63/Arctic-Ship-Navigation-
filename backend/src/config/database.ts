import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connectDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not configured; database persistence is unavailable');
    return;
  }
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.warn('Database connection failed, running with in-memory fallback:', error instanceof Error ? error.message : error);
  }
}
