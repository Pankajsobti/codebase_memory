import mongoose from "mongoose";

const { Schema, model } = mongoose;

const GraphEdgeSchema = new Schema(
  {
    repoId: {
      type: Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    target: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["imports", "calls", "renders", "queries", "extends"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

GraphEdgeSchema.index({ repoId: 1 });
GraphEdgeSchema.index({ repoId: 1, source: 1, target: 1, type: 1 });

const GraphEdge = model("GraphEdge", GraphEdgeSchema);

export default GraphEdge;