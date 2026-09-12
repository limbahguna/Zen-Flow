import { Router } from "express";
import { db, tasksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { getAuthenticatedUserId, requireSupabaseAuth } from "../middlewares/supabaseAuth";

const router = Router();

router.use("/tasks", requireSupabaseAuth);

router.get("/tasks/summary", async (req, res) => {
  const userId = getAuthenticatedUserId(res);
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, userId));
  const summary = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };
  res.json(summary);
});

router.get("/tasks", async (req, res) => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query params" });
    return;
  }
  const { status } = parsed.data;
  const userId = getAuthenticatedUserId(res);
  const conditions = [eq(tasksTable.userId, userId)];
  if (status) conditions.push(eq(tasksTable.status, status));
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(...conditions))
    .orderBy(tasksTable.createdAt);
  res.json(
    tasks.map((t) => ({
      id: t.id,
      userId: t.userId,
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  );
});

router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { title, description, status, priority, dueDate } = parsed.data;
  const userId = getAuthenticatedUserId(res);
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const [task] = await db
    .insert(tasksTable)
    .values({ id, userId, title, description, status, priority, dueDate })
    .returning();
  res.status(201).json({
    id: task.id,
    userId: task.userId,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    createdAt: task.createdAt.toISOString(),
  });
});

router.patch("/tasks/:id", async (req, res) => {
  const paramsParsed = UpdateTaskParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const bodyParsed = UpdateTaskBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const updates: Record<string, unknown> = {};
  const b = bodyParsed.data;
  if (b.title !== undefined) updates.title = b.title;
  if (b.description !== undefined) updates.description = b.description;
  if (b.status !== undefined) updates.status = b.status;
  if (b.priority !== undefined) updates.priority = b.priority;
  if (b.dueDate !== undefined) updates.dueDate = b.dueDate;

  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(
      and(
        eq(tasksTable.id, paramsParsed.data.id),
        eq(tasksTable.userId, getAuthenticatedUserId(res)),
      ),
    )
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({
    id: task.id,
    userId: task.userId,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    createdAt: task.createdAt.toISOString(),
  });
});

router.delete("/tasks/:id", async (req, res) => {
  const parsed = DeleteTaskParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const [task] = await db
    .delete(tasksTable)
    .where(
      and(
        eq(tasksTable.id, parsed.data.id),
        eq(tasksTable.userId, getAuthenticatedUserId(res)),
      ),
    )
    .returning({ id: tasksTable.id });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.status(204).send();
});

export default router;
