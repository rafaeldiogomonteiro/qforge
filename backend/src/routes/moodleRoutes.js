import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  getMoodleConnectionHandler,
  listMoodleCoursesHandler,
  testMoodleFunctionHandler,
  importQuestionBankToMoodleHandler,
  listMoodleQuestionCategoriesHandler,
  importQuestionBankFromCategoryHandler,
  upsertMoodleConnectionHandler,
} from "../controllers/MoodleController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/test-function", testMoodleFunctionHandler);
router.post("/import-question-bank", importQuestionBankToMoodleHandler);

router.get("/connection", getMoodleConnectionHandler);
router.put("/connection", upsertMoodleConnectionHandler);
router.get("/courses", listMoodleCoursesHandler);
router.get("/question-categories", listMoodleQuestionCategoriesHandler);
router.post("/import-question-bank-from-category", importQuestionBankFromCategoryHandler);

export default router;

