import mongoose from "mongoose";

const labelSchema = new mongoose.Schema(
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

// Cada utilizador só pode ter uma label com o mesmo nome normalizado.
labelSchema.index(
  { owner: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { owner: { $exists: true } } }
);

export default mongoose.model("Label", labelSchema);
