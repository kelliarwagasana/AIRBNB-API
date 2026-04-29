import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
export async function connectDB() {
    await prisma.$connect();
}
