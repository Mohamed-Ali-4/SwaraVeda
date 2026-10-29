import type { Dialect } from './types';

/** Broad regions of India, in the order the shelf runs: south to north, then east to the islands. */
export const ZONES = [
  { id: 'south', label: 'South' },
  { id: 'central', label: 'Central' },
  { id: 'west', label: 'West' },
  { id: 'north', label: 'North' },
  { id: 'northeast', label: 'Northeast' },
  { id: 'islands', label: 'Islands' },
] as const;
export type ZoneId = (typeof ZONES)[number]['id'];

/** A font that has the glyphs of each script, loaded in index.html. */
export const SCRIPT_FONTS: Record<string, { font: string; weight: number }> = {
  Kannada: { font: 'Noto Sans Kannada', weight: 600 },
  Tamil: { font: 'Noto Sans Tamil', weight: 600 },
  Malayalam: { font: 'Noto Sans Malayalam', weight: 600 },
  Telugu: { font: 'Noto Sans Telugu', weight: 600 },
  Devanagari: { font: 'Noto Sans Devanagari', weight: 600 },
  Odia: { font: 'Noto Sans Oriya', weight: 600 },
  'Ol Chiki': { font: 'Noto Sans Ol Chiki', weight: 600 },
  Gujarati: { font: 'Noto Sans Gujarati', weight: 600 },
  Tibetan: { font: 'Noto Serif Tibetan', weight: 600 },
  Lepcha: { font: 'Noto Sans Lepcha', weight: 400 },
  Limbu: { font: 'Noto Sans Limbu', weight: 400 },
  Bengali: { font: 'Noto Sans Bengali', weight: 600 },
  'Meetei Mayek': { font: 'Noto Sans Meetei Mayek', weight: 600 },
  Latin: { font: 'Newsreader', weight: 400 },
};

/** Each dialect's own name for itself, the script that name is written in, and its region. */
const INFO: [name: string, native: string, script: string, zone: ZoneId][] = [
  ['Tulu', 'ತುಳು', 'Kannada', 'south'],
  ['Kodava', 'ಕೊಡವ', 'Kannada', 'south'],
  ['Beary', 'ಬ್ಯಾರಿ', 'Kannada', 'south'],
  ['Havyaka Kannada', 'ಹವ್ಯಕ', 'Kannada', 'south'],
  ['Badaga', 'ಬಡಗ', 'Kannada', 'south'],
  ['Toda', 'தோடா', 'Tamil', 'south'],
  ['Kota', 'கோத்தா', 'Tamil', 'south'],
  ['Irula', 'இருளா', 'Tamil', 'south'],
  ['Saurashtra', 'சௌராஷ்டிரா', 'Tamil', 'south'],
  ['Paniya', 'പണിയ', 'Malayalam', 'south'],
  ['Jeseri', 'ജസരി', 'Malayalam', 'south'],
  ['Yerukula', 'ఎరుకల', 'Telugu', 'south'],
  ['Koya', 'కోయ', 'Telugu', 'south'],
  ['Lambadi', 'लंबाडी', 'Devanagari', 'south'],
  ['Soliga', 'ಸೋಲಿಗ', 'Kannada', 'south'],
  ['Jenu Kurumba', 'ಜೇನು ಕುರುಬ', 'Kannada', 'south'],
  ['Arebhashe', 'ಅರೆಭಾಷೆ', 'Kannada', 'south'],
  ['Kundagannada', 'ಕುಂದಗನ್ನಡ', 'Kannada', 'south'],
  ['Muthuvan', 'മുതുവാൻ', 'Malayalam', 'south'],
  ['Kanikkaran', 'കാണിക്കാർ', 'Malayalam', 'south'],
  ['Konda Dora', 'కొండ దొర', 'Telugu', 'south'],
  ['Gondi', 'गोंडी', 'Devanagari', 'central'],
  ['Kurukh', 'कुड़ुख', 'Devanagari', 'central'],
  ['Kui', 'କୁଇ', 'Odia', 'central'],
  ['Kuvi', 'କୁଭି', 'Odia', 'central'],
  ['Sora', 'ସଉରା', 'Odia', 'central'],
  ['Juang', 'ଜୁଆଙ୍ଗ', 'Odia', 'central'],
  ['Bonda', 'ବଣ୍ଡା', 'Odia', 'central'],
  ['Santali', 'ᱥᱟᱱᱛᱟᱲᱤ', 'Ol Chiki', 'central'],
  ['Ho', 'हो', 'Devanagari', 'central'],
  ['Mundari', 'मुंडारी', 'Devanagari', 'central'],
  ['Halbi', 'हल्बी', 'Devanagari', 'central'],
  ['Chhattisgarhi', 'छत्तीसगढ़ी', 'Devanagari', 'central'],
  ['Bhili', 'भीली', 'Devanagari', 'central'],
  ['Nihali', 'निहाली', 'Devanagari', 'central'],
  ['Bagheli', 'बघेली', 'Devanagari', 'central'],
  ['Malvi', 'मालवी', 'Devanagari', 'central'],
  ['Nimadi', 'निमाड़ी', 'Devanagari', 'central'],
  ['Nagpuri', 'नागपुरी', 'Devanagari', 'central'],
  ['Khortha', 'खोरठा', 'Devanagari', 'central'],
  ['Kurmali', 'कुड़माली', 'Devanagari', 'central'],
  ['Sambalpuri', 'ସମ୍ବଲପୁରୀ', 'Odia', 'central'],
  ['Desiya', 'ଦେଶିଆ', 'Odia', 'central'],
  ['Bhatri', 'भतरी', 'Devanagari', 'central'],
  ['Malto', 'माल्तो', 'Devanagari', 'central'],
  ['Kharia', 'खड़िया', 'Devanagari', 'central'],
  ['Birhor', 'बिरहोर', 'Devanagari', 'central'],
  ['Asur', 'असुर', 'Devanagari', 'central'],
  ['Gutob', 'ଗୁଟବ', 'Odia', 'central'],
  ['Parji', 'परजी', 'Devanagari', 'central'],
  ['Kolami', 'कोलामी', 'Devanagari', 'central'],
  ['Warli', 'वारली', 'Devanagari', 'west'],
  ['Katkari', 'कातकरी', 'Devanagari', 'west'],
  ['Konkani (Goan)', 'कोंकणी', 'Devanagari', 'west'],
  ['Malvani', 'मालवणी', 'Devanagari', 'west'],
  ['Kutchi', 'કચ્છી', 'Gujarati', 'west'],
  ['Marwari', 'मारवाड़ी', 'Devanagari', 'west'],
  ['Mewari', 'मेवाड़ी', 'Devanagari', 'west'],
  ['Dhundhari', 'ढूंढाड़ी', 'Devanagari', 'west'],
  ['Shekhawati', 'शेखावाटी', 'Devanagari', 'west'],
  ['Wagdi', 'वागड़ी', 'Devanagari', 'west'],
  ['Ahirani', 'अहिराणी', 'Devanagari', 'west'],
  ['Varhadi', 'वऱ्हाडी', 'Devanagari', 'west'],
  ['Kokna', 'कोकणा', 'Devanagari', 'west'],
  ['Bundeli', 'बुंदेली', 'Devanagari', 'north'],
  ['Awadhi', 'अवधी', 'Devanagari', 'north'],
  ['Bhojpuri', 'भोजपुरी', 'Devanagari', 'north'],
  ['Maithili', 'मैथिली', 'Devanagari', 'north'],
  ['Magahi', 'मगही', 'Devanagari', 'north'],
  ['Garhwali', 'गढ़वाली', 'Devanagari', 'north'],
  ['Kumaoni', 'कुमाऊँनी', 'Devanagari', 'north'],
  ['Jaunsari', 'जौनसारी', 'Devanagari', 'north'],
  ['Kangri', 'कांगड़ी', 'Devanagari', 'north'],
  ['Kinnauri', 'किन्नौरी', 'Devanagari', 'north'],
  ['Dogri', 'डोगरी', 'Devanagari', 'north'],
  ['Ladakhi', 'ལ་དྭགས་སྐད', 'Tibetan', 'north'],
  ['Braj Bhasha', 'ब्रज भाषा', 'Devanagari', 'north'],
  ['Kannauji', 'कन्नौजी', 'Devanagari', 'north'],
  ['Angika', 'अंगिका', 'Devanagari', 'north'],
  ['Bajjika', 'बज्जिका', 'Devanagari', 'north'],
  ['Surjapuri', 'सुरजापुरी', 'Devanagari', 'north'],
  ['Gaddi', 'गद्दी', 'Devanagari', 'north'],
  ['Mandeali', 'मंडियाली', 'Devanagari', 'north'],
  ['Kullui', 'कुल्लवी', 'Devanagari', 'north'],
  ['Mahasu Pahari', 'महासुई', 'Devanagari', 'north'],
  ['Bhadarwahi', 'भद्रवाही', 'Devanagari', 'north'],
  ['Gojri', 'गोजरी', 'Devanagari', 'north'],
  ['Balti', 'Balti', 'Latin', 'north'],
  ['Purgi', 'Purgi', 'Latin', 'north'],
  ['Shina', 'Shina', 'Latin', 'north'],
  ['Brokskat', 'Brokskat', 'Latin', 'north'],
  ['Lepcha', 'ᰛᰩᰵ', 'Lepcha', 'northeast'],
  ['Limbu', 'ᤕᤰᤌᤢᤱ ᤐᤠᤴ', 'Limbu', 'northeast'],
  ['Sikkimese', 'འབྲས་ལྗོངས་སྐད', 'Tibetan', 'northeast'],
  ['Toto', 'টোটো', 'Bengali', 'northeast'],
  ['Bodo', 'बड़ो', 'Devanagari', 'northeast'],
  ['Mising', 'Mising Agom', 'Latin', 'northeast'],
  ['Karbi', 'Arleng', 'Latin', 'northeast'],
  ['Dimasa', 'Grao-Dima', 'Latin', 'northeast'],
  ['Rabha', 'রাভা', 'Bengali', 'northeast'],
  ['Kokborok', 'Kókborok', 'Latin', 'northeast'],
  ['Khasi', 'Ka Ktien Khasi', 'Latin', 'northeast'],
  ['Garo', 'A·chikku', 'Latin', 'northeast'],
  ['Mizo', 'Mizo ṭawng', 'Latin', 'northeast'],
  ['Meitei', 'ꯃꯩꯇꯩꯂꯣꯟ', 'Meetei Mayek', 'northeast'],
  ['Tangkhul', 'Tangkhul', 'Latin', 'northeast'],
  ['Ao', 'Ao', 'Latin', 'northeast'],
  ['Angami', 'Tenyidie', 'Latin', 'northeast'],
  ['Lotha', 'Kyong', 'Latin', 'northeast'],
  ['Adi', 'Adi', 'Latin', 'northeast'],
  ['Nyishi', 'Nyishi', 'Latin', 'northeast'],
  ['Apatani', 'Apatani', 'Latin', 'northeast'],
  ['Wancho', 'Wancho', 'Latin', 'northeast'],
  ['Idu Mishmi', 'Idu', 'Latin', 'northeast'],
  ['Koro', 'Koro', 'Latin', 'northeast'],
  ['Sherdukpen', 'Sherdukpen', 'Latin', 'northeast'],
  ['Sylheti', 'সিলেটি', 'Bengali', 'northeast'],
  ['Hajong', 'Hajong', 'Latin', 'northeast'],
  ['Rajbanshi', 'রাজবংশী', 'Bengali', 'northeast'],
  ['Chakma', 'চাকমা', 'Bengali', 'northeast'],
  ['Tiwa', 'Tiwa', 'Latin', 'northeast'],
  ['Deori', 'Deori', 'Latin', 'northeast'],
  ['Galo', 'Galo', 'Latin', 'northeast'],
  ['Tagin', 'Tagin', 'Latin', 'northeast'],
  ['Tawang Monpa', 'Monpa', 'Latin', 'northeast'],
  ['Konyak', 'Konyak', 'Latin', 'northeast'],
  ['Sumi', 'Sümi', 'Latin', 'northeast'],
  ['Rengma', 'Rengma', 'Latin', 'northeast'],
  ['Thadou', 'Thadou', 'Latin', 'northeast'],
  ['Hmar', 'Hmar', 'Latin', 'northeast'],
  ['Paite', 'Paite', 'Latin', 'northeast'],
  ['Zeme', 'Zeme', 'Latin', 'northeast'],
  ['Rongmei', 'Rongmei', 'Latin', 'northeast'],
  ['Great Andamanese', 'Jeru', 'Latin', 'islands'],
  ['Onge', 'Önge', 'Latin', 'islands'],
  ['Jarawa', 'Ang', 'Latin', 'islands'],
  ['Car Nicobarese', 'Car Nicobarese', 'Latin', 'islands'],
  ['Central Nicobarese', 'Central Nicobarese', 'Latin', 'islands'],
  ['Shompen', 'Shompen', 'Latin', 'islands'],
];

const BY_NAME = new Map(INFO.map((row, order) => [row[0].toLowerCase(), { row, order }]));

// For dialects added later: guess the region from the state names in `region`.
const ZONE_HINTS: [RegExp, ZoneId][] = [
  [/andaman|nicobar|lakshadweep/i, 'islands'],
  [/assam|meghalaya|manipur|mizoram|nagaland|tripura|arunachal|sikkim/i, 'northeast'],
  [/karnataka|kerala|tamil|telangana|andhra|puducherry/i, 'south'],
  [/goa|gujarat|rajasthan|maharashtra/i, 'west'],
  [/chhattisgarh|odisha|jharkhand|madhya/i, 'central'],
  [/uttar|bihar|himachal|uttarakhand|jammu|kashmir|ladakh|punjab|haryana|delhi|bengal/i, 'north'],
];

const ASR_NAMES: Record<string, string> = {
  kn: 'Kannada', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', hi: 'Hindi', mr: 'Marathi',
  bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi', ur: 'Urdu', ne: 'Nepali', as: 'Assamese',
  si: 'Sinhala', sa: 'Sanskrit', en: 'English',
};

export interface ShelfDialect extends Dialect {
  native: string;
  nativeScript: string;
  zone: ZoneId | null;
  /** A short place name for the caption, e.g. "Kodagu, Karnataka". */
  place: string;
  /** The language Vani transcribes it as, if set. */
  asrName?: string;
  order: number;
}

/** The dialects in shelf order, each with its own name, script and region. */
export function toShelf(dialects: Dialect[]): ShelfDialect[] {
  return dialects
    .map((d, i) => {
      const known = BY_NAME.get(d.name.toLowerCase());
      const scriptGuess = (d.script || '').split(',')[0].trim();
      const zone = known?.row[3] ?? ZONE_HINTS.find(([re]) => re.test(d.region || ''))?.[1] ?? null;
      return {
        ...d,
        native: known?.row[1] ?? d.name,
        nativeScript: known?.row[2] ?? (SCRIPT_FONTS[scriptGuess] ? scriptGuess : 'Latin'),
        zone,
        place: (d.region || '').split(/[;(]/)[0].trim(),
        asrName: d.asr_language ? ASR_NAMES[d.asr_language] ?? d.asr_language.toUpperCase() : undefined,
        order: known ? known.order : INFO.length + i,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** A stable small number from a string, to vary each cover's artwork. */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
