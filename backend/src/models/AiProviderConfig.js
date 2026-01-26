import mongoose from "mongoose";
import crypto from "crypto";

// Chave de encriptação (em produção, usar variável de ambiente)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "qforge_default_32_byte_key_1234"; // 32 bytes
const ENCRYPTION_IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  if (!text || !text.includes(":")) return text;
  try {
    const [ivHex, encrypted] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    // Se falhar a desencriptação, devolve o valor original (pode ser texto claro antigo)
    return text;
  }
}

const aiProviderConfigSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },        // ex: "OpenAI"
    provider: { type: String, default: "openai" }, // ex: "openai", "groq"
    model: { type: String, required: true },       // ex: "gpt-4o-mini"

    apiKeyEncrypted: { type: String, required: true }, // API key encriptada
    baseUrl: { type: String },                     // se usares API compatível

    maxRequestsPerDay: { type: Number, default: 1000 },
    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// Virtual para definir apiKey (encripta automaticamente)
aiProviderConfigSchema.virtual("apiKey").set(function (value) {
  this.apiKeyEncrypted = encrypt(value);
});

// Método para obter apiKey desencriptada
aiProviderConfigSchema.methods.getApiKey = function () {
  return decrypt(this.apiKeyEncrypted);
};

// Método estático para encontrar e desencriptar
aiProviderConfigSchema.statics.findWithDecryptedKey = async function (filter) {
  const config = await this.findOne(filter);
  if (config) {
    config._decryptedApiKey = config.getApiKey();
  }
  return config;
};

export default mongoose.model("AiProviderConfig", aiProviderConfigSchema);
export { encrypt, decrypt };
