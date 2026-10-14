import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, documentChunks, projects, uploads } from "@bobai/db";
import { generateEmbedding, rerankText } from "./embeddings.js";

const CHUNK_SIZE=4000,CHUNK_OVERLAP=400,MAX_CHUNKS=2000;
function stableUuid(uploadId:string,index:number){const chars=createHash("sha256").update(`${uploadId}:${index}`).digest("hex").slice(0,32).split("");chars[12]="5";chars[16]=((parseInt(chars[16],16)&3)|8).toString(16);return `${chars.slice(0,8).join("")}-${chars.slice(8,12).join("")}-${chars.slice(12,16).join("")}-${chars.slice(16,20).join("")}-${chars.slice(20).join("")}`;}
export function chunkText(text:string,size=CHUNK_SIZE,overlap=CHUNK_OVERLAP){const normalized=text.replace(/\r\n/g,"\n").trim();if(!normalized)return[];const safeSize=Math.max(500,Math.min(20000,Math.floor(size))),safeOverlap=Math.max(0,Math.min(Math.floor(safeSize/2),Math.floor(overlap)));const chunks:string[]=[];let start=0;while(start<normalized.length&&chunks.length<MAX_CHUNKS){let end=Math.min(normalized.length,start+safeSize);if(end<normalized.length){const boundary=Math.max(normalized.lastIndexOf("\n",end),normalized.lastIndexOf(" ",end));if(boundary>start+safeSize*.6)end=boundary;}const value=normalized.slice(start,end).trim();if(value)chunks.push(value);if(end>=normalized.length)break;start=Math.max(start+1,end-safeOverlap);}return chunks;}
export async function indexUpload(uploadId:string,workspaceId:string,projectId?:string){
  const [upload]=await db.select({id:uploads.id,text:uploads.extractedText,projectId:uploads.projectId,metadata:uploads.metadata})
    .from(uploads).where(and(eq(uploads.id,uploadId),eq(uploads.workspaceId,workspaceId),isNull(uploads.deletedAt))).limit(1);
  if(!upload)throw new Error("upload not found");
  let currentMetadata=upload.metadata&&typeof upload.metadata==="object"&&!Array.isArray(upload.metadata)?upload.metadata as Record<string,unknown>:{};
  const effectiveProjectId=projectId||upload.projectId||undefined;
  const setProcessing=async(processing:string,extra:Record<string,unknown>={})=>{
    currentMetadata={...currentMetadata,...extra,processing};
    await db.update(uploads).set({metadata:currentMetadata,updatedAt:new Date()})
      .where(and(eq(uploads.id,uploadId),eq(uploads.workspaceId,workspaceId),isNull(uploads.deletedAt)));
  };
  try{
    if(effectiveProjectId){
      const [project]=await db.select({id:projects.id}).from(projects)
        .where(and(eq(projects.id,effectiveProjectId),eq(projects.workspaceId,workspaceId),eq(projects.archived,false),isNull(projects.deletedAt))).limit(1);
      if(!project)throw new Error("project not found");
    }
    await setProcessing("indexing",{indexingStartedAt:new Date().toISOString(),indexingError:null});
    const chunks=chunkText(upload.text||"");
    await db.delete(documentChunks).where(and(eq(documentChunks.uploadId,uploadId),eq(documentChunks.workspaceId,workspaceId)));
    let embedded=0;
    for(let index=0;index<chunks.length;index++){
      const content=chunks[index];
      const embedding=await generateEmbedding(content);
      await db.insert(documentChunks).values({id:stableUuid(uploadId,index),workspaceId,uploadId,projectId:effectiveProjectId,chunkIndex:index,content,embedding,metadata:{indexedAt:new Date().toISOString()}});
      if(embedding)embedded++;
    }
    await setProcessing("indexed",{indexedAt:new Date().toISOString(),chunkCount:chunks.length,embeddedChunkCount:embedded,indexingError:null});
    return{uploadId,chunks:chunks.length,embedded};
  }catch(error){
    const message=error instanceof Error?error.message:"document indexing failed";
    await setProcessing("indexing_failed",{indexingFailedAt:new Date().toISOString(),indexingError:message.slice(0,300)}).catch(()=>undefined);
    throw error;
  }
}

export async function searchDocumentChunks(workspaceId:string,userId:string,query:string,projectId?:string,limit=12){const safeLimit=Math.min(50,Math.max(1,Math.floor(limit)));const vector=await generateEmbedding(query);if(vector){const candidateLimit=Math.min(50,Math.max(safeLimit,safeLimit*3));const projectFilter=projectId?sql`and c.project_id = ${projectId}`:sql``;const rows=await db.execute(sql`select c.id,c.upload_id as "uploadId",c.project_id as "projectId",c.chunk_index as "chunkIndex",c.content,c.metadata,1-(c.embedding <=> ${JSON.stringify(vector)}::vector) as similarity from document_chunks c inner join uploads u on u.id=c.upload_id where c.workspace_id=${workspaceId} and u.uploaded_by=${userId} and u.deleted_at is null ${projectFilter} order by c.embedding <=> ${JSON.stringify(vector)}::vector limit ${candidateLimit}`) as unknown as Array<Record<string,unknown>>;
    const rerankCount=Math.min(rows.length,20); let reranked=false; const rescored=[] as Array<Record<string,unknown>>;
    for(let index=0;index<rows.length;index++){const row=rows[index];if(index<rerankCount&&typeof row.content==="string"){const score=await rerankText(query,row.content);if(typeof score==="number"){const similarity=typeof row.similarity==="number"?row.similarity:Number(row.similarity||0); rescored.push({...row,similarity:similarity*.65+score*.35,rerankScore:score});reranked=true;continue;}}rescored.push(row);}
    rescored.sort((a,b)=>Number(b.similarity||0)-Number(a.similarity||0)); return rescored.slice(0,safeLimit).map(row=>reranked?{...row,metadata:{...(row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)?row.metadata:{}),retrieval:"vector+reranker"}}:row);
  }
  const pattern=`%${query.replace(/[\\%_]/g,"\\$&")}%`;const projectFilter=projectId?sql`and c.project_id = ${projectId}`:sql``;const rows=await db.execute(sql`select c.id,c.upload_id as "uploadId",c.project_id as "projectId",c.chunk_index as "chunkIndex",c.content,c.metadata from document_chunks c inner join uploads u on u.id=c.upload_id where c.workspace_id=${workspaceId} and u.uploaded_by=${userId} and u.deleted_at is null ${projectFilter} and c.content ilike ${pattern} escape '\\' order by c.chunk_index asc limit ${safeLimit}`);return rows as unknown as Array<Record<string,unknown>>;}
