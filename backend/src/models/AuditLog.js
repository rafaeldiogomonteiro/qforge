import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false // pode haver logs de sistema sem user
    },

    action: {
      type: String,
      required: true
      // ex: "LOGIN", "CREATE_QUESTION", "UPDATE_BANK", "EXPORT_BANK"
    },

    entityType: {
      type: String,
      required: true
      // ex: "USER", "QUESTION", "QUESTION_BANK", "EXPORT"
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false
    },

    ip: { type: String },

    metadata: {
      type: Object // qualquer info adicional (antes/depois, etc.)
    }
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditLogSchema);
