export interface Dialect {
  id: string;
  name: string;
  iso_code?: string;
  region?: string;
  script?: string;
  endangerment_status?: string;
  description?: string;
  asr_language?: string;
}

export type RecordingStatus = 'uploaded' | 'transcribing' | 'transcribed' | 'verified';

export interface Recording {
  id: string;
  title: string;
  audio_url?: string;
  storage_path?: string;
  duration_seconds?: number;
  dialect_id?: string;
  contributor_id?: string;
  speaker_name?: string;
  speaker_age_group?: string;
  genre?: string;
  recorded_place?: string;
  recorded_at?: string;
  consent_public: boolean;
  consent_ai_training: boolean;
  licence: string;
  status: RecordingStatus;
  notes?: string;
  created_at: string;
}

export interface Segment {
  id: string;
  recording_id: string;
  seq: number;
  start_ms: number;
  end_ms: number;
  asr_text?: string;
  corrected_text?: string;
  transliteration?: string;
  translation_en?: string;
  speaker_label?: string;
  verified_by?: string;
  verified_at?: string;
}

export interface Job {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

export interface SearchHit {
  segment_id: string;
  recording_id: string;
  recording_title: string;
  audio_url?: string;
  dialect_name?: string;
  seq: number;
  start_ms: number;
  end_ms: number;
  text?: string;
  score: number;
}

export const genres = ['conversation', 'narrative', 'song', 'prayer', 'proverb', 'other'] as const;
