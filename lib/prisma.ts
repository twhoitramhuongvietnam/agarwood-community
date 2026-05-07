import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

import { Pool } from "pg"

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!
  const isProduction = process.env.NODE_ENV === "production"
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
  
  const pool = new Pool({
    connectionString,
    max: isLocal ? 20 : 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
    // Chỉ dùng SSL nếu là production VÀ không phải database local
    ssl: (isProduction && !isLocal) ? { rejectUnauthorized: false } : undefined
  })
  
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
