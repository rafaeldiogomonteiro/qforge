import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false }
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    bank: { type: mongoose.Schema.Types.ObjectId, ref: "QuestionBank", required: true },

    type: {
      type: String,
      enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"],
      required: true
    },

    stem: { type: String, required: true },

    options: [optionSchema],
    acceptableAnswers: [String],

    difficulty: { type: Number, min: 1, max: 3, default: 2 },
    tags: [String],
    category: String,

    feedbackCorrect: String,
    feedbackIncorrect: String,

    source: { type: String, enum: ["MANUAL", "AI"], default: "MANUAL" },
    status: {
      type: String,
      enum: ["DRAFT", "APPROVED", "ARCHIVED"],
      default: "DRAFT"
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Question", questionSchema);
