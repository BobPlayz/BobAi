import { specialistConfigured, specialistInfer } from "./specialistRuntime.js";
import { modelRuntime } from "./modelRuntime.js";
const MAX_IMAGE_BYTES=12*1024*1024; const MAX_PROMPT_LENGTH=8000;
export async function analyzeImage(imageBase64:string,prompt="analyze this image"){
 const normalized=imageBase64.replace(/^data:[^;]+;base64,/,'').trim(); if(!normalized)throw new Error("image data is required"); if(normalized.length>Math.ceil(MAX_IMAGE_BYTES*4/3))throw new Error("image exceeds the 12 MB limit"); if(typeof prompt!=="string"||prompt.length>MAX_PROMPT_LENGTH)throw new Error("vision prompt is too long"); if(!specialistConfigured("vision"))throw new Error("local vision is unavailable; configure a BobAI vision model artifact. No external provider is used.");
 const release=await modelRuntime.acquire("bob-vision-0.1"); try{const result=await specialistInfer("vision",{imageBase64:normalized,prompt:prompt.trim()||"Describe the image and relevant details."}); const response=typeof result.response==="string"?result.response.trim():""; if(!response)throw new Error("the local vision model returned no image description"); return{model:"bob-vision-0.1",response:response.slice(0,8000)};}finally{release();}
}
