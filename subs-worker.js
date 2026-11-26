// Subtítulos automáticos: Whisper ejecutándose en el teléfono (transformers.js + ONNX Runtime Web).
// El modelo se descarga una sola vez y queda guardado en la caché del navegador.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js";

env.allowLocalModels = false;

let asr = null;
let loaded = "";

self.onmessage = async (e) => {
  const { audio, model, language } = e.data;
  try {
    if (!asr || loaded !== model) {
      asr = null;
      asr = await pipeline("automatic-speech-recognition", model, {
        dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
        device: "wasm",
        progress_callback: (p) => {
          if (p.status === "progress") self.postMessage({ type: "download", file: p.file, loaded: p.loaded, total: p.total });
        },
      });
      loaded = model;
    }
    self.postMessage({ type: "transcribing" });
    const out = await asr(audio, {
      language: language || null,
      task: "transcribe",
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    self.postMessage({ type: "done", chunks: out.chunks || [], text: out.text || "" });
  } catch (err) {
    self.postMessage({ type: "error", message: String(err?.message || err) });
  }
};
