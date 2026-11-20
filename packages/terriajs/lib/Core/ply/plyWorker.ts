import { parsePly, PlyError, PlyErrorCode } from "./parsePly";
import plyToGlb, { PlyModel } from "./plyToGlb";

export interface PlyWorkerRequest {
  buffer: ArrayBuffer;
  maximumPoints: number;
}

export type PlyWorkerResponse =
  | { model: PlyModel }
  | { error: { code: PlyErrorCode | "unknown"; message: string } };

const ctx = self as unknown as Worker;

ctx.onmessage = (event: MessageEvent<PlyWorkerRequest>) => {
  let response: PlyWorkerResponse;
  try {
    const { buffer, maximumPoints } = event.data;
    response = { model: plyToGlb(parsePly(buffer, { maximumPoints })) };
  } catch (e) {
    response = {
      error: {
        code: e instanceof PlyError ? e.code : "unknown",
        message: e instanceof Error ? e.message : String(e)
      }
    };
  }
  ctx.postMessage(response, "model" in response ? [response.model.glb] : []);
};
