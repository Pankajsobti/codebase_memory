import mongoose from "mongoose";
import env from "./env.js";

export async function connectDB() {
  try {
    await mongoose.connect(env.mongodbUri);
    console.log(`[db] Connected to MongoDB at ${env.mongodbUri}`);
  } catch (err) {
    console.error("[db] MongoDB connection error:", err.message);
    throw err;
  }
}

export default connectDB;
