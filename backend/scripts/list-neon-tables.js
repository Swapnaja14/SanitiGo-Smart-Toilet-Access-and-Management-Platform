import dotenv from "dotenv";
dotenv.config();

import prisma from "../src/config/prisma.js";

async function listTables() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT 
        table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log("Tables in Neon database (public schema):");
    for (const t of tables) {
      if (t.table_name === "_prisma_migrations") {
        const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "_prisma_migrations"`);
        console.log(` - ${t.table_name} (${count[0].count} migrations recorded)`);
      } else {
        const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${t.table_name}"`);
        console.log(` - ${t.table_name} (${count[0].count} rows)`);
      }
    }
  } catch (err) {
    console.error("Error listing tables:", err);
  } finally {
    await prisma.$disconnect();
  }
}

listTables();
