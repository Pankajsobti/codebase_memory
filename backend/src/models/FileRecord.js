import mongoose from "mongoose";

const { Schema, model } = mongoose;

const FunctionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    startLine: {
      type: Number,
      required: true,
    },
    endLine: {
      type: Number,
      required: true,
    },
    calls: {
      type: [String],
      default: [],
    },
    isComponent: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const ClassSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    startLine: {
      type: Number,
      required: true,
    },
    endLine: {
      type: Number,
      required: true,
    },
    calls: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const ApiRouteSchema = new Schema(
  {
    method: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const FileRecordSchema = new Schema(
  {
    repoId: {
      type: Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    language: {
      type: String,
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    content: {
      type: String,
      default: "",
    },
    imports: {
      type: [String],
      default: [],
    },
    exports: {
      type: [String],
      default: [],
    },
    functions: {
      type: [FunctionSchema],
      default: [],
    },
    classes: {
      type: [ClassSchema],
      default: [],
    },
    apiRoutes: {
      type: [ApiRouteSchema],
      default: [],
    },
    dbModels: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

FileRecordSchema.index({ repoId: 1 });
FileRecordSchema.index({ repoId: 1, filePath: 1 }, { unique: true });

const FileRecord = model("FileRecord", FileRecordSchema);

export default FileRecord;