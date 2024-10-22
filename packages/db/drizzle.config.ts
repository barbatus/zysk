import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // host: process.env.APP_POSTGRES_HOST ?? "",
    // port: Number(process.env.APP_POSTGRES_PORT),
    // user: process.env.APP_POSTGRES_USERNAME,
    // password: process.env.APP_POSTGRES_PASSWORD,
    // database: process.env.APP_POSTGRES_DATABASE ?? "",
    url: "postgresql://postgres:pgpassword@localhost:5432/zysk",
  },
});
