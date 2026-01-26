import mongoose from "mongoose";

const aiGenerationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    bank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionBank",
      required: true
    },

    providerConfig: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiProviderConfig",
      required: false
    },

    prompt: { type: String, required: true },  // o pedido feito à IA

    params: {
      numQuestions: { type: Number, default: 5 },
      types: [{ type: String }],              // ["MULTIPLE_CHOICE", ...]
      difficulty: [{ type: Number }],         // [1,2,3]
      language: { type: String }              // "pt-PT", "en-US"
    },

    questionIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Question" }
    ],

    // Questões sugeridas pela IA (antes de aprovar/aplicar)
    suggestedQuestions: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },

    // Workflow de aprovação
    status: {
      type: String,
      enum: ["PENDING", "APPLIED", "REJECTED"],
      default: "APPLIED"
    },

    rawResponse: { type: Object } // opcional: debug/trace
  },
  { timestamps: true }
);

export default mongoose.model("AiGeneration", aiGenerationSchema);
