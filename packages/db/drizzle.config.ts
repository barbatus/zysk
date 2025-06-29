import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: `postgresql://${process.env.APP_DB_USERNAME}:${process.env.APP_DB_PASSWORD}@${process.env.APP_DB_HOST}:${process.env.APP_DB_PORT}/${process.env.APP_DB_DATABASE}`,
  },
});
