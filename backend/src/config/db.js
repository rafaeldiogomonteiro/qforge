import mongoose from "mongoose";

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Ligado à MongoDB Atlas");
  } catch (error) {
    console.error("❌ Erro ao ligar à MongoDB:", error.message);
    throw error;
  }
}
