import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { 
      type: String, 
      required: true, 
      enum: ["Criação", "Edição", "Eliminação", "Exportação", "Importação", "Geração IA", "Visualização"]
    },
    targetType: { 
      type: String, 
      enum: ["Banco", "Questão", "Etiqueta", "Capítulo", "Teste", "Moodle"]
    },
    targetId: mongoose.Schema.Types.ObjectId,
    targetName: String,
    details: mongoose.Schema.Types.Mixed,
    result: {
      type: String,
      enum: ["Sucesso", "Falha"],
      default: "Sucesso"
    },
    errorMessage: String,
    ipAddress: String
  },
  { timestamps: true }
);

// Índices para melhor performance em queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
