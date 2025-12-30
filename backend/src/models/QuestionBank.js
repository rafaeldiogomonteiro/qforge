import mongoose from "mongoose";

const questionBankSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    language: { type: String, default: "pt-PT" },
    discipline: { type: String },
    academicYear: { type: String },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    coordinators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    tags: [{ type: String }],

    status: {
      type: String,
      enum: ["DRAFT", "IN_REVIEW", "OFFICIAL", "ARCHIVED"],
      default: "DRAFT",
    },

    version: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

export default mongoose.model("QuestionBank", questionBankSchema);
