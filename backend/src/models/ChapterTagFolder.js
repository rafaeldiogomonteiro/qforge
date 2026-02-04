import mongoose from "mongoose";

const chapterTagFolderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, index: true },
    description: { type: String, default: "", trim: true },
    // position controla a ordenação das pastas (drag & drop)
    position: { type: Number, required: true, default: 0, index: true },
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

// Cada utilizador só pode ter uma pasta com o mesmo nome normalizado
chapterTagFolderSchema.index(
  { owner: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { owner: { $exists: true } } }
);

export default mongoose.model("ChapterTagFolder", chapterTagFolderSchema);
