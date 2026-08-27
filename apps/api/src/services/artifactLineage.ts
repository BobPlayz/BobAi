export type ArtifactLineage = {
  artifactId: string;
  jobId?: string;
  parentIds?: string[];
  provider?: string;
  model?: string;
  prompt?: string;
  createdAt: string;
};

export const lineage = (artifactId: string, input: Omit<ArtifactLineage, "artifactId" | "createdAt">): ArtifactLineage => ({
  artifactId,
  ...input,
  createdAt: new Date().toISOString()
});
