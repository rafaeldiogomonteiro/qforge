import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, "Nome é obrigatório"],
      trim: true 
    },
    email: { 
      type: String, 
      required: [true, "Email é obrigatório"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Email inválido"]
    },
    passwordHash: { 
      type: String, 
      required: [true, "Password é obrigatória"]
    },
    institution: { type: String, trim: true },
    department: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
