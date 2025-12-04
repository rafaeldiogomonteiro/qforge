import mongoose from "mongoose";

const exportJobSchema = new mongoose.Schema(
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

    format: {
      type: String,
      enum: ["GIFT", "AIKEN", "MOODLE_XML", "JSON"],
      required: true
    },

    filters: {
      tags: [{ type: String }],
      difficulty: [{ type: Number }],
      status: [{ type: String }]
    },

    // se quiseres guardar o ficheiro num path do servidor
    filePath: { type: String },

    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      default: "SUCCESS"
    },

    errorMessage: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("ExportJob", exportJobSchema);
