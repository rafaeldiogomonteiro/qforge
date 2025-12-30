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

    difficulty: { type: Number, min: 1, max: 5, default: 2 },

    tags: [{ type: String }],

    source: {
      type: String,
      enum: ["MANUAL", "AI", "IMPORTED"],
      default: "MANUAL",
    },

    status: {
      type: String,
      enum: ["DRAFT", "IN_REVIEW", "APPROVED"],
      default: "DRAFT",
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
