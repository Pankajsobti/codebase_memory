import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/codebase_memory",
  githubToken: process.env.GITHUB_TOKEN || "",
  groqApiKey: process.env.GROQ_API_KEY || "",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};

export default env;