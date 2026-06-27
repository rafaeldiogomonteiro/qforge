import mongoose from "mongoose";

const moodleConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    moodleBaseUrl: { type: String, required: true },
    // Token do Moodle Web Services (webservice REST).
    moodleToken: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model(
  "MoodleConnection",
  moodleConnectionSchema
);

