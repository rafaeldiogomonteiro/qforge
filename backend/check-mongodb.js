#!/usr/bin/env node

/**
 * Diagnóstico de conexão MongoDB
 * 
 * Uso: node check-mongodb.js
 * 
 * Verifica se MongoDB está instalado, rodando, e se a conexão funciona
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkMongoDB() {
  console.log("🔍 Diagnóstico MongoDB\n");

  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error("❌ MONGODB_URI não está definida em .env");
    process.exit(1);
  }

  console.log("📋 Configuração:");
  console.log(`   MONGODB_URI: ${mongoUri}\n`);

  try {
    console.log("⏳ A tentar conectar à MongoDB (timeout: 5 segundos)...\n");

    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    console.log("✅ Ligação com SUCESSO!");
    console.log(`   Host: ${connection.connection.host}`);
    console.log(`   Porto: ${connection.connection.port}`);
    console.log(`   Base de dados: ${connection.connection.name}`);

    // Testa uma operação simples
    const collections = await connection.connection.listCollections();
    console.log(`   Coleções: ${collections.length}`);

    await mongoose.disconnect();
    console.log("\n✅ MongoDB está funcionando e pronto para usar!");
    process.exit(0);
  } catch (error) {
    console.error("❌ ERRO ao conectar:");
    console.error(`   ${error.message}\n`);

    console.log("💡 Sugestões de resolução:\n");

    if (error.message.includes("ECONNREFUSED") || error.message.includes("connect ECONNREFUSED")) {
      console.log("1️⃣  MongoDB não está rodando localmente.");
      console.log("   Opções:");
      console.log("   • Se tens MongoDB instalado: mongod");
      console.log("   • Se tens Docker: docker run -d -p 27017:27017 --name qforge-mongo mongo");
      console.log("   • Se usas MongoDB Atlas: coloca a URI correta em .env\n");
    }

    if (error.message.includes("getaddrinfo")) {
      console.log("1️⃣  Host não encontrado. Verifica a URI em .env\n");
    }

    if (error.message.includes("timeout")) {
      console.log("1️⃣  Timeout na conexão. MongoDB pode não estar respondendo.\n");
    }

    console.log("📝 Passos para corrigir:\n");
    console.log("   a) Se não tens MongoDB installed:");
    console.log("      → Instala via https://www.mongodb.com/try/download/community");
    console.log("      → Ou usa Docker: docker run -d -p 27017:27017 mongo\n");
    console.log("   b) Se tens instalado mas não está rodando:");
    console.log("      → Gere mongod no terminal\n");
    console.log("   c) Se usas MongoDB Atlas (nuvem):");
    console.log("      → Copia a URI de ligação");
    console.log("      → Coloca em .env: MONGODB_URI=mongodb+srv://...\n");

    process.exit(1);
  }
}

checkMongoDB();
