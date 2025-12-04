import mongoose from "mongoose";

const moodleIntegrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },      // "Moodle IPVC"
    baseUrl: { type: String, required: true },   // "https://moodle.ipvc.pt"
    token: { type: String, required: true },     // token de serviço

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    isActive: { type: Boolean, default: true },

    description: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("MoodleIntegration", moodleIntegrationSchema);
