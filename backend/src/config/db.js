import mongoose from "mongoose";

export async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error("MONGODB_URI não está definida em .env");
    }

    console.log("🔄 A tentar conectar à MongoDB...");
    console.log(`   (${mongoUri.split("@")[1]?.slice(0, 40) || "custom"}...)`);

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log("✅ Ligado à MongoDB com sucesso!");
  } catch (error) {
    console.error("\n❌ ERRO ao ligar à MongoDB:");
    console.error(`   ${error.message}`);
    console.error("\n💡 Verifica:");
    console.error("   • A connection string em backend/.env está correta?");
    console.error("   • A password está certa? (dev / dev12345678)");
    console.error("   • O cluster do MongoDB Atlas foi criado?");
    console.error("   • IP whitelist permite acesso? (Atlas > Network Access)");
    console.error("\nPara resolver: https://account.mongodb.com/account/login\n");
    throw error;
  }
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
