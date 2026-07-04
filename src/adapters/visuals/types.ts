export type Orientation = 'portrait' | 'landscape';

export interface VisualCandidate {
  id: string;
  type: 'video' | 'image';
  url: string;
  width: number;
  height: number;
  durationSec?: number;
}

export interface VisualsProvider {
  id: string;
  searchVideos(query: string, orientation: Orientation, minDurationSec: number): Promise<VisualCandidate[]>;
  searchPhotos(query: string, orientation: Orientation): Promise<VisualCandidate[]>;
}
