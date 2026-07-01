import mongoose from "mongoose";

const pdfSourceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    filename: { type: String, required: true },
    mimeType: { type: String, default: "" },

    // Guardamos apenas o texto extraído (com gzip) para não ocupar demasiado espaço.
    extractedTextGz: { type: Buffer, required: true },
    extractedTextLength: { type: Number, default: 0 },

    originalSize: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("PdfSource", pdfSourceSchema);

