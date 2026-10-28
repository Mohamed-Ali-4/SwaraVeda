import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One audio element for a page, with segment-aware playback: play a range
 * and stop, or loop it while someone corrects the transcript.
 * `time` updates ~10×/s for React; draw smooth animation from `audio.current`.
 */
export function useAudioPlayer(src?: string) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [looping, setLooping] = useState<{ start: number; end: number } | null>(null);
  const stopAt = useRef<number | null>(null);
  const loop = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (!src) return;
    const a = new Audio();
    a.preload = 'metadata';
    a.src = src;
    audio.current = a;
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration * 1000 : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onPause);

    let raf = 0;
    let last = -1;
    let lastPush = 0;
    const tick = (now: number) => {
      const t = a.currentTime * 1000;
      if (loop.current && t >= loop.current.end) a.currentTime = loop.current.start / 1000;
      else if (stopAt.current !== null && t >= stopAt.current) {
        a.pause();
        stopAt.current = null;
      }
      if (t !== last && now - lastPush > 100) {
        last = t;
        lastPush = now;
        setTime(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      a.pause();
      a.removeAttribute('src');
      a.load();
      audio.current = null;
    };
  }, [src]);

  const seek = useCallback((ms: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, ms / 1000);
    setTime(ms);
  }, []);

  const play = useCallback(() => { audio.current?.play().catch(() => {}); }, []);
  const pause = useCallback(() => audio.current?.pause(), []);
  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      stopAt.current = null;
      a.play().catch(() => {});
    } else a.pause();
  }, []);

  const stopLoop = useCallback(() => {
    loop.current = null;
    setLooping(null);
  }, []);

  /** Plays one passage; with `repeat`, loops it until stopLoop(). */
  const playRange = useCallback((start: number, end: number, repeat = false) => {
    loop.current = repeat ? { start, end } : null;
    setLooping(loop.current);
    stopAt.current = repeat ? null : end;
    seek(start);
    audio.current?.play().catch(() => {});
  }, [seek]);

  const setRate = useCallback((r: number) => {
    if (audio.current) audio.current.playbackRate = r;
    setRateState(r);
  }, []);

  return { audio, time, duration, playing, rate, looping, seek, play, pause, toggle, playRange, stopLoop, setRate };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;

const peakCache = new Map<string, Promise<number[] | null>>();
const MAX_DECODE_BYTES = 40 * 1024 * 1024;

/** Loudness envelope for drawing a waveform; null when the file is too big
 * to decode in the browser or can't be fetched. */
export function loadPeaks(url: string, buckets = 900): Promise<number[] | null> {
  if (!peakCache.has(url)) {
    peakCache.set(url, (async () => {
      const res = await fetch(url);
      if (!res.ok) return null;
      const size = Number(res.headers.get('content-length') || 0);
      if (size > MAX_DECODE_BYTES) return null;
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > MAX_DECODE_BYTES) return null;
      const ctx = new AudioContext();
      try {
        const decoded = await ctx.decodeAudioData(buffer);
        const data = decoded.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / buckets));
        const peaks: number[] = [];
        for (let i = 0; i < buckets; i++) {
          let max = 0;
          for (let j = i * step, end = Math.min(data.length, j + step); j < end; j += 4) {
            const v = Math.abs(data[j]);
            if (v > max) max = v;
          }
          peaks.push(max);
        }
        const top = Math.max(...peaks) || 1;
        return peaks.map((p) => p / top);
      } finally {
        ctx.close();
      }
    })().catch(() => null));
  }
  return peakCache.get(url)!;
}

/** Plays single passages from different recordings (search results, review
 * queue). One passage plays at a time; playing it again stops it. */
export function usePassagePlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const endAt = useRef(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    const a = new Audio();
    audio.current = a;
    const onTime = () => {
      if (a.currentTime * 1000 >= endAt.current) {
        a.pause();
        setPlayingId(null);
      }
    };
    const onEnd = () => setPlayingId(null);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onEnd);
    return () => {
      a.pause();
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onEnd);
    };
  }, []);

  const toggle = useCallback((id: string, url: string | undefined, start: number, end: number) => {
    const a = audio.current;
    if (!a || !url) return;
    if (playingId === id) {
      a.pause();
      setPlayingId(null);
      return;
    }
    endAt.current = end;
    const begin = () => {
      a.currentTime = start / 1000;
      a.play().catch(() => setPlayingId(null));
    };
    if (a.src !== url) {
      a.src = url;
      a.addEventListener('loadedmetadata', begin, { once: true });
    } else begin();
    setPlayingId(id);
  }, [playingId]);

  return { playingId, toggle };
}
