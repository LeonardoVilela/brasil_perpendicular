import modelCard from "../../public/models/d3-mobilenetv3/model-card.json";

export const D3_MODEL_PATH = "models/d3-mobilenetv3/encoder.onnx";
export const D3_MODEL_CARD = modelCard;

export type D3Calibration =
  | { status: "pending" }
  | { status: "validated"; realLikeMax: number; aiLikeMin: number };
