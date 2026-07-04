import { Orientation, VisualCandidate, VisualsProvider } from './types';

/**
 * Placeholder for AI-generated imagery (e.g. FLUX-schnell, ~$0.006/image via
 * fal.ai or Together). Deliberately unimplemented while the system runs at $0 —
 * see docs/RESEARCH.md §4. When enabled it slots into the gather-visuals
 * fallback chain between stock photos and gradient clips.
 */
export class FluxProvider implements VisualsProvider {
  id = 'flux';

  async searchVideos(_q: string, _o: Orientation, _d: number): Promise<VisualCandidate[]> {
    return [];
  }

  async searchPhotos(_q: string, _o: Orientation): Promise<VisualCandidate[]> {
    return [];
  }
}
