import type { Segment } from './types';

export type SegmentState = 'draft' | 'corrected' | 'verified';

export const segmentState = (s: Segment): SegmentState =>
  s.verified_at ? 'verified' : s.corrected_text ? 'corrected' : 'draft';
