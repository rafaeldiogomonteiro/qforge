import mongoose from "mongoose";

const aiProviderConfigSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },        // ex: "OpenAI"
    provider: { type: String, default: "openai" }, // ex: "openai", "otherapi"
    model: { type: String, required: true },       // ex: "gpt-4o-mini"

    apiKey: { type: String, required: true },      // idealmente encriptado
    baseUrl: { type: String },                     // se usares API compatível

    maxRequestsPerDay: { type: Number, default: 1000 },
    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("AiProviderConfig", aiProviderConfigSchema);
