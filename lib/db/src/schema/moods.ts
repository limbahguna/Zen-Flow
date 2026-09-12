import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moodsTable = pgTable("moods", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  mood: text("mood").notNull(),
  score: integer("score").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMoodSchema = createInsertSchema(moodsTable).omit({ createdAt: true });
export type InsertMood = z.infer<typeof insertMoodSchema>;
export type MoodEntry = typeof moodsTable.$inferSelect;
