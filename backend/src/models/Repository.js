import mongoose from "mongoose";

const { Schema, model } = mongoose;

const RepositorySchema = new Schema(
  {
    repoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    owner: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    defaultBranch: {
      type: String,
      default: "main",
    },
    status: {
      type: String,
      enum: ["pending", "cloning", "parsing", "ready", "failed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

RepositorySchema.index({ owner: 1, name: 1 });

const Repository = model("Repository", RepositorySchema);

export default Repository;