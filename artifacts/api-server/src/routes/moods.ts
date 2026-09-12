import { Router } from "express";
import { db, moodsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateMoodBody } from "@workspace/api-zod";
import { getAuthenticatedUserId, requireSupabaseAuth } from "../middlewares/supabaseAuth";

const router = Router();

router.use("/moods", requireSupabaseAuth);

router.get("/moods", async (req, res) => {
  const userId = getAuthenticatedUserId(res);
  const moods = await db
    .select()
    .from(moodsTable)
    .where(eq(moodsTable.userId, userId))
    .orderBy(moodsTable.createdAt);
  res.json(
    moods.map((m) => ({
      id: m.id,
      userId: m.userId,
      mood: m.mood,
      score: m.score,
      note: m.note ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

router.post("/moods", async (req, res) => {
  const parsed = CreateMoodBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { mood, score, note } = parsed.data;
  const userId = getAuthenticatedUserId(res);
  const id = `mood_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const [entry] = await db
    .insert(moodsTable)
    .values({ id, userId, mood, score, note })
    .returning();
  res.status(201).json({
    id: entry.id,
    userId: entry.userId,
    mood: entry.mood,
    score: entry.score,
    note: entry.note ?? null,
    createdAt: entry.createdAt.toISOString(),
  });
});

export default router;
