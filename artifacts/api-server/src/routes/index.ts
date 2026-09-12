import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import moodsRouter from "./moods";
import aiCoachRouter from "./aiCoach";
import accountRouter from "./account";
import aiReportsRouter from "./aiReports";
import subscriptionRouter from "./subscription";
import sleepRouter from "./sleep";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tasksRouter);
router.use(moodsRouter);
router.use(aiCoachRouter);
router.use(accountRouter);
router.use(aiReportsRouter);
router.use(subscriptionRouter);
router.use(sleepRouter);

export default router;
