import { useEffect, useState } from 'react';

/**
 * "Swara" (voice, note) in the scripts of India, each with its own print ink,
 * and a dialect written in that script for the cover's book shelf.
 */
export const SWARA = [
  { text: 'Swara', lang: 'en', name: 'English', font: 'Newsreader', ink: '#A8461F', dialect: 'Khasi', native: 'Ka Ktien Khasi' },
  { text: 'स्वर', lang: 'hi', name: 'Hindi', font: 'Noto Serif Devanagari', ink: '#C9541A', dialect: 'Bhojpuri', native: 'भोजपुरी' },
  { text: 'ஸ்வர', lang: 'ta', name: 'Tamil', font: 'Noto Serif Tamil', ink: '#B3261E', dialect: 'Toda', native: 'தோடா' },
  { text: 'స్వర', lang: 'te', name: 'Telugu', font: 'Noto Serif Telugu', ink: '#0E7470', dialect: 'Koya', native: 'కోయ' },
  { text: 'ಸ್ವರ', lang: 'kn', name: 'Kannada', font: 'Noto Serif Kannada', ink: '#A87A08', dialect: 'Tulu', native: 'ತುಳು' },
  { text: 'സ്വര', lang: 'ml', name: 'Malayalam', font: 'Noto Serif Malayalam', ink: '#2E7031', dialect: 'Paniya', native: 'പണിയ' },
  { text: 'স্বর', lang: 'bn', name: 'Bengali', font: 'Noto Serif Bengali', ink: '#7A4B2A', dialect: 'Toto', native: 'টোটো' },
  { text: 'સ્વર', lang: 'gu', name: 'Gujarati', font: 'Noto Serif Gujarati', ink: '#C26A12', dialect: 'Kutchi', native: 'કચ્છી' },
  { text: 'ସ୍ୱର', lang: 'or', name: 'Odia', font: 'Noto Serif Oriya', ink: '#8C2A3C', dialect: 'Juang', native: 'ଜୁଆଙ୍ଗ' },
  { text: 'ਸਵਰ', lang: 'pa', name: 'Punjabi', font: 'Noto Serif Gurmukhi', ink: '#8A6A00', dialect: 'Malwai', native: 'ਮਲਵਈ' },
] as const;

export const HOLD_MS = 1000;

/** The index of the script on show, moving on every second. `go` jumps to one. */
export function useSwaraCycle() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setI((n) => (n + 1) % SWARA.length), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [i]);
  return [i, setI] as const;
}
