import mongoose from "mongoose";

const { Schema, model } = mongoose;

const GraphNodeSchema = new Schema(
  {
    repoId: {
      type: Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
    },
    nodeId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["file", "function", "class", "component", "apiRoute", "dbModel"],
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    filePath: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

GraphNodeSchema.index({ repoId: 1 });
GraphNodeSchema.index({ repoId: 1, nodeId: 1 }, { unique: true });

const GraphNode = model("GraphNode", GraphNodeSchema);

export default GraphNode;