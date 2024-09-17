import { PrismaClient } from "@prisma/client";

const prisma = global.prisma || new PrismaClient();

if (import.meta.env.VITE_NODE_ENV !== "production") {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
}

export default prisma;
