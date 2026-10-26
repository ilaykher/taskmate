import prisma from './prisma.js';

export default async function connectDB() {
  if (!process.env.DATABASE_URL?.trim()) {
    const error = new Error('DATABASE_URL is missing. Add your Neon PostgreSQL connection string to backend/.env.');
    console.error(`PostgreSQL connection failed: ${error.message}`);
    throw error;
  }
  try {
    await prisma.$connect();
    console.log('Neon PostgreSQL connected successfully.');
  } catch (error) {
    console.error(`PostgreSQL connection failed. Check DATABASE_URL, Neon project status, and network access. Details: ${error.message}`);
    throw error;
  }
}
