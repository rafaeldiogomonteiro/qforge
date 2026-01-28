import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionBank",
      required: true,
    },

    type: {
      type: String,
      enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "OPEN"],
      required: true,
      default: "MULTIPLE_CHOICE",
    },

    stem: { type: String, required: true }, // enunciado

    options: [optionSchema], // usado em choice/true_false

    acceptableAnswers: [{ type: String }], // usado em short/open

    // 1=Básico, 2=Normal, 3=Difícil, 4=Muito Difícil
    difficulty: { type: Number, min: 1, max: 4, default: 2 },

    // Contador de utilizações (ex.: exportação)
    usageCount: { type: Number, default: 0 },

    // Legacy: mantido para compatibilidade (nomes das chapterTags)
    tags: [{ type: String }],

    // Labels (ex.: "Época Normal")
    labels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Label",
      },
    ],

    // Tags de capítulos (ex.: "HTML", "CSS")
    chapterTags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChapterTag",
      },
    ],

    source: {
      type: String,
      enum: ["MANUAL", "AI", "IMPORTED"],
      default: "MANUAL",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Question", questionSchema);
