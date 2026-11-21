export type RepositoryVisibility = 'public' | 'private';

export type AnalysisStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed';

export interface RepositoryReference {
  owner: string;
  name: string;
  visibility: RepositoryVisibility;
}
