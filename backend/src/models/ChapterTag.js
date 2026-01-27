import mongoose from "mongoose";

const chapterTagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, index: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Cada utilizador só pode ter uma tag com o mesmo nome normalizado.
chapterTagSchema.index(
  { owner: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { owner: { $exists: true } } }
);

export default mongoose.model("ChapterTag", chapterTagSchema);
