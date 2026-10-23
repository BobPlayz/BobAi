import { createHash } from "node:crypto";
import { ollamaEmbedding, ollamaEmbeddingEnabled, ollamaEmbeddingModel } from "./ollamaProvider.js";
const MAX_INPUT=8000,DIMENSIONS=1536;
function local(text:string){const v=new Float64Array(DIMENSIONS);const terms=text.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);for(const term of terms){const d=createHash("sha256").update(term).digest();for(let i=0;i<8;i++)v[d.readUInt16BE(i*2)%DIMENSIONS]+=d[i]/255-.5;}if(!terms.length)return Array.from(v);let n=0;for(const x of v)n+=x*x;n=Math.sqrt(n)||1;return Array.from(v,x=>x/n);}
export function embeddingsConfigured(){return true;}
export async function generateModelEmbeddingWithModel(text:string):Promise<{vector:number[];modelId:string}|null>{const input=text.trim().slice(0,MAX_INPUT);if(!input)return null;try{const vector=await ollamaEmbedding(input);return vector?{vector,modelId:ollamaEmbeddingModel()}:null;}catch{return null;}}
export async function generateModelEmbedding(text:string):Promise<number[]|null>{return (await generateModelEmbeddingWithModel(text))?.vector??null;}
export async function generateEmbedding(text:string):Promise<number[]|null>{const input=text.trim().slice(0,MAX_INPUT);if(!input)return null;const semantic=await generateModelEmbeddingWithModel(input);return semantic?.vector??local(input);}
