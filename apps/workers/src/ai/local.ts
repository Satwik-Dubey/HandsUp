/**
 * Local models for the per-question fast path (design: "AI pipeline").
 *  - Embeddings: all-MiniLM-L6-v2, 384 numbers per question, stored in pgvector.
 *  - Sentiment: DistilBERT fine-tuned on SST-2, mapped to -1 (negative) … +1 (positive).
 * Both run on the CPU through transformers.js (ONNX). They download once (~90 MB) into
 * .cache/models the first time the workers start.
 *
 * If the download fails (offline, firewall) or LOCAL_MODELS=off, a word-based fallback
 * keeps grouping working: it groups questions that share keywords instead of meaning.
 */
import { AI, keywords, normalize } from "@handsup/shared";
import { env } from "../env";

type Extractor = (text: string, opts: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array }>;
type Classifier = (text: string) => Promise<{ label: string; score: number }[]>;

let extractor: Extractor | null = null;
let classifier: Classifier | null = null;
let loading: Promise<void> | null = null;
let mode: "model" | "fallback" = "fallback";

export function aiMode() {
  return mode;
}

/** Similarity a question needs to join a group, for whichever embedder is in use. */
export function similarityThreshold() {
  return mode === "model" ? AI.clusterSimilarity : AI.clusterSimilarityFallback;
}

export function loadLocalModels(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    if (!env.localModels) {
      console.log("[nlp] LOCAL_MODELS=off, using the word-based fallback");
      return;
    }
    try {
      const t = Date.now();
      const tf = await import("@huggingface/transformers");
      tf.env.cacheDir = env.modelsCacheDir;
      tf.env.allowLocalModels = false;
      const [e, c] = await Promise.all([
        tf.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" }),
        tf.pipeline("sentiment-analysis", "Xenova/distilbert-base-uncased-finetuned-sst-2-english", { dtype: "q8" }),
      ]);
      extractor = e as unknown as Extractor;
      classifier = c as unknown as Classifier;
      mode = "model";
      console.log(`[nlp] local models ready in ${((Date.now() - t) / 1000).toFixed(1)}s`);
    } catch (err) {
      console.warn(`[nlp] couldn't load local models (${(err as Error).message.split("\n")[0]}). Using the word-based fallback.`);
    }
  })();
  return loading;
}

const DIM = 384;

/** Word-based vector: each keyword (and keyword pair) hashed into one of 384 slots. */
function fallbackEmbed(text: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  const words = keywords(text);
  const add = (token: string, w: number) => {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) h = Math.imul(h ^ token.charCodeAt(i), 16777619);
    v[(h >>> 0) % DIM]! += w;
  };
  words.forEach((w, i) => {
    add(w, 1);
    if (i > 0) add(`${words[i - 1]} ${w}`, 0.5);
  });
  return normalize(v);
}

const NEG = /\b(confus|lost|hard|difficult|don'?t (get|understand)|no idea|boring|too fast|too slow|unclear|stuck|wrong|bad|hate|why)\w*/i;
const POS = /\b(thanks?|great|love|clear|cool|awesome|helpful|nice|good|interesting|got it)\w*/i;

function fallbackSentiment(text: string): number {
  return (POS.test(text) ? 0.5 : 0) - (NEG.test(text) ? 0.5 : 0);
}

export async function embed(text: string): Promise<number[]> {
  await loadLocalModels();
  if (extractor) {
    const out = await extractor(text, { pooling: "mean", normalize: true });
    return Array.from(out.data);
  }
  return fallbackEmbed(text);
}

export async function sentiment(text: string): Promise<number> {
  await loadLocalModels();
  if (classifier) {
    const [r] = await classifier(text);
    if (r) return Number((r.label === "POSITIVE" ? r.score : -r.score).toFixed(3));
  }
  return fallbackSentiment(text);
}
