const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, SectionType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ImageRun, ShadingType, VerticalAlign, LevelFormat, HighlightColor, TabStopType,
} = require('docx');

const OUT = process.argv[2];
const FIG = process.argv[3];
const F = 'Times New Roman';
const COL = 5040; // one column, DXA (3.5")

// ---------- helpers
const r = (text, o = {}) => new TextRun({ text, font: F, size: o.size || 20, bold: o.b, italics: o.i, smallCaps: o.sc,
  subScript: o.sub, superScript: o.sup, highlight: o.hl ? HighlightColor.YELLOW : undefined });
// paragraph from a mini-markup: **bold**, *italic*, [[highlight]], _{sub}, ^{sup}
// References are numbered in order of first citation, as IEEE requires: write [@key] in the text.
const CITED = [];
const cite = (str) => str.replace(/\[@([a-z0-9]+)\]/g, (m, k) => {
  if (!CITED.includes(k)) CITED.push(k);
  return `[${CITED.indexOf(k) + 1}]`;
});
function runs(str, size = 20) {
  str = cite(str);
  const out = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[\[(.+?)\]\]|_\{(.+?)\}|\^\{(.+?)\}/g;
  let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(r(str.slice(last, m.index), { size }));
    if (m[1]) out.push(r(m[1], { size, b: true }));
    else if (m[2]) out.push(r(m[2], { size, i: true }));
    else if (m[3]) out.push(r(m[3], { size, hl: true }));
    else if (m[4]) out.push(r(m[4], { size, sub: true, i: true }));
    else if (m[5]) out.push(r(m[5], { size, sup: true }));
    last = re.lastIndex;
  }
  if (last < str.length) out.push(r(str.slice(last), { size }));
  return out;
}
const P = (str, o = {}) => new Paragraph({
  children: runs(str, o.size || 20), alignment: o.align || AlignmentType.BOTH,
  indent: o.noIndent ? undefined : { firstLine: 202 }, spacing: { after: o.after ?? 0, line: 240 },
});
const H1 = (num, text) => new Paragraph({
  children: [r(`${num}. `, { sc: true }), r(text, { sc: true })], alignment: AlignmentType.CENTER,
  spacing: { before: 160, after: 80 }, keepNext: true,
});
const H2 = (letter, text) => new Paragraph({
  children: [r(`${letter}. ${text}`, { i: true })], spacing: { before: 100, after: 60 }, keepNext: true,
});
const Bul = (str) => new Paragraph({ children: runs(str), numbering: { reference: 'bul', level: 0 }, alignment: AlignmentType.BOTH, spacing: { after: 20 } });
const Num = (str) => new Paragraph({ children: runs(str), numbering: { reference: 'num', level: 0 }, alignment: AlignmentType.BOTH, spacing: { after: 20 } });
const Eq = (str, n) => new Paragraph({
  children: [new TextRun({ text: "\t", font: F, size: 20 }), ...runs(str), new TextRun({ text: `\t(${n})`, font: F, size: 20 })],
  tabStops: [{ type: TabStopType.CENTER, position: COL / 2 }, { type: TabStopType.RIGHT, position: COL }],
  spacing: { before: 60, after: 60 },
  indent: { firstLine: 0 },
});
const Cap = (str, align = AlignmentType.CENTER) => new Paragraph({ children: runs(str, 16), alignment: align, spacing: { before: 60, after: 120 }, keepNext: false });
const TCap = (num, str) => [
  new Paragraph({ children: [r(`TABLE ${num}`, { size: 16, sc: true })], alignment: AlignmentType.CENTER, spacing: { before: 120 }, keepNext: true }),
  new Paragraph({ children: [r(str, { size: 16, sc: true })], alignment: AlignmentType.CENTER, spacing: { after: 60 }, keepNext: true }),
];
const thin = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
function table(rows, widths, { hlRows = [] } = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((row, i) => new TableRow({
      tableHeader: i === 0,
      children: row.map((c, j) => new TableCell({
        width: { size: widths[j], type: WidthType.DXA },
        margins: { top: 30, bottom: 30, left: 60, right: 60 },
        verticalAlign: VerticalAlign.CENTER,
        borders: { top: i === 0 ? thin : none, bottom: (i === 0 || i === rows.length - 1) ? thin : none, left: none, right: none },
        children: [new Paragraph({
          children: runs(i === 0 ? `**${c}**` : (hlRows.includes(i) && j > 0 ? `[[${c}]]` : c), 16),
          alignment: j === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
        })],
      })),
    })),
  });
}
function boxed(lines) { // algorithm box
  return new Table({
    width: { size: COL, type: WidthType.DXA }, columnWidths: [COL],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: COL, type: WidthType.DXA }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
      borders: { top: thin, bottom: thin, left: none, right: none },
      children: lines.map((l, i) => new Paragraph({
        children: runs(l, 17), spacing: { after: 10 },
        border: i === 0 ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 2 } } : undefined,
        indent: i > 0 && /^\s/.test(l) ? { left: 240 } : undefined,
      })),
    })] })],
  });
}

// ---------- front matter (one column)
const front = [
  new Paragraph({ children: [r('Choosing Proxy Languages for Speech Recognition of Unwritten Indian Dialects Using Correction Effort', { size: 48 })],
    alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
];
const authors = [
  ['Laksh Yadav', 'Mikul Swamy', 'Mohamad Aashim'],
  ['Mohamed Ali', 'Priyanka K R'],
];
const aff = ['Dept. of Computer Science and Engineering', 'RV Institute of Technology and Management', 'Bengaluru, India'];
const EMAILS = {
  'Laksh Yadav': 'lakshyadav1212@gmail.com',
  'Mikul Swamy': 'mikulnswamy07@gmail.com',
  'Mohamad Aashim': 'mohamad.aashim11@gmail.com',
  'Mohamed Ali': 'mohamedali04123@gmail.com',
  'Priyanka K R': 'priyankakr.rvitm@rvei.edu.in',
};
function authorRow(names, lastRole) {
  const w = Math.floor(10440 / names.length);
  return new Table({
    width: { size: w * names.length, type: WidthType.DXA }, columnWidths: names.map(() => w), alignment: AlignmentType.CENTER,
    rows: [new TableRow({ children: names.map((n) => new TableCell({
      width: { size: w, type: WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none },
      children: [
        new Paragraph({ children: [r(n, { size: 22 })], alignment: AlignmentType.CENTER }),
        ...aff.map((a) => new Paragraph({ children: [r(a, { size: 18, i: a.startsWith('Dept') })], alignment: AlignmentType.CENTER })),
        new Paragraph({ children: [r(n === lastRole ? 'Assistant Professor' : 'Student, B.E. (CSE)', { size: 18 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [r(EMAILS[n], { size: 18 })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
      ],
    })) })],
  });
}
front.push(authorRow(authors[0]), authorRow(authors[1], 'Priyanka K R'), new Paragraph({ children: [], spacing: { after: 120 } }));

// ---------- body (two columns)
const B = [];
B.push(new Paragraph({ children: [r('Abstract', { size: 18, b: true, i: true }), r(': Most of India’s spoken varieties have little or no written text and are not supported by speech recognition. Multilingual models such as Whisper can transcribe an unsupported dialect only as one of the languages they know, and the best choice of this ', { size: 18, b: true }), r('proxy language', { size: 18, b: true, i: true }), r(' is not obvious: Tulu, for example, is written in Kannada script but is lexically distinct from Kannada. We present SwaraVeda, a deployed, consent-first community archive in which members record speech in the browser (also offline), an assistant named Vani drafts a time-aligned transcript with Whisper large-v3, native speakers correct every passage while listening, and verifiers approve it. Because the archive keeps both the machine draft and the human correction of every passage, the edit distance between them is available at no extra annotation cost. We propose using this correction effort as a signal to rank candidate proxy languages per dialect and to update the choice as verified data accumulates, implement this selection in the archive, and define an evaluation protocol based on character and word error rates. The archive catalogues 139 dialects with their script, region, ISO 639-3 code and a proxy-language hint, separates consent for public listening from consent for AI training, and exports verified passages as a training dataset for future dialect-specific models.', { size: 18, b: true })],
  alignment: AlignmentType.BOTH, spacing: { after: 100 } }));
B.push(new Paragraph({ children: [r('Index Terms', { size: 18, b: true, i: true }), r(': endangered languages, low-resource speech recognition, Whisper, human-in-the-loop, language documentation, proxy language, consent, Indian dialects', { size: 18, b: true })], alignment: AlignmentType.BOTH, spacing: { after: 120 } }));

B.push(H1('I', 'Introduction'));
B.push(P('In the 2011 Census of India, people named 19,569 different mother tongues; after linguistic scrutiny the Census counted 1,369 of them and classified these under 121 languages [@census]. Many of the remaining varieties are spoken mainly by small and ageing communities and are classified as vulnerable or endangered [@unesco]. Their songs, rituals and everyday speech, such as the Tulu *paddanas* of coastal Karnataka, survive only orally. When the last fluent speakers are gone, this knowledge is lost.'));
B.push(P('Speech technology could help preserve these varieties, but it needs transcribed audio, which these dialects do not have. Large multilingual models such as Whisper [@radford] and MMS [@pratap] cover major Indian languages but not dialects such as Tulu, Toda, Kodava or Beary; only recent models fine-tuned on new corpora such as Vaani begin to include a few of them [@sravaani]. Manual transcription by linguists is slow, so field recordings often remain unused.'));
B.push(P('A practical workaround is to transcribe an unsupported dialect *as if* it were a related, supported language, the *proxy language*, and let native speakers correct the result. The quality of the first draft, and therefore the correction effort, depends on that choice. The right proxy is not always the language that shares the script: Tulu uses Kannada script but is a separate South Dravidian language, and Beary is written in Kannada or Malayalam script while being closest to Malayalam.'));
B.push(P('This paper makes the following contributions:', { after: 40 }));
B.push(Bul('**SwaraVeda**, a deployed web archive for endangered Indian dialects that combines in-browser and offline recording, per-recording dual consent, AI drafting, community correction and verification, and search by words and by meaning (Section III).'));
B.push(Bul('**Correction effort as a signal**: a method that uses the edit distance between Whisper’s draft and the verified human correction to rank and update the proxy language of each dialect, without any annotation beyond the community’s normal work (Section IV).'));
B.push(Bul('A catalogue of **139 Indian dialects** with script, region, ISO 639-3 code and a proxy-language hint, and a **consent-scoped dataset export** that pairs every machine draft with its correction (Sections III and VI).'));
B.push(Bul('An implementation of this selection inside the deployed archive, and an evaluation protocol that compares automatic language identification with candidate proxies by character and word error rate (Sections III and V).'));

B.push(H1('II', 'Related Work'));
B.push(H2('A', 'Tools for language documentation'));
B.push(P('Aikuma [@bird] introduced a mobile app for recording, respeaking and translating endangered-language speech, and LIG-Aikuma [@blachon] extended it for parallel speech collection in the field. ELPIS [@foley] lets documentary linguists train speech recognisers on their own transcribed recordings using the Kaldi toolkit [@povey]. These tools assume that a linguist transcribes or curates the data; they do not use a large pretrained model to produce the first draft, and they do not choose a proxy language.'));
B.push(H2('B', 'Crowdsourced speech corpora'));
B.push(P('Mozilla Common Voice [@ardila] collects read sentences and validates clips by community votes. Karya [@abraham] crowdsources speech data for Indian languages from low-income workers, and IndicSUPERB [@javed2023] released the Kathbath corpus for 12 Indian languages. Read-speech collection requires written prompts, which unwritten dialects lack, and it does not capture songs, stories or spontaneous conversation.'));
B.push(H2('C', 'Multilingual and low-resource ASR'));
B.push(P('Self-supervised models such as wav2vec 2.0 [@baevski] reduce the labelled data needed for a new language, and IndicWav2Vec [@javed2022] pretrains on 40 Indian languages. MMS [@pratap] scales speech recognition to over 1,100 languages using language-specific adapters, while Whisper [@radford] is trained with weak supervision on 680,000 hours of audio and outputs timestamps and translations. All still require labelled data or a supported language identifier for each target variety; none tells us which supported language best stands in for an unsupported dialect.'));
B.push(H2('D', 'Choosing a stand-in language'));
B.push(P('When fine-tuning is not feasible, the common practice for a language Whisper does not support is to reuse the tag of the closest supported language; Huang *et al.* [@huang2025] instead combine the embeddings of several language tags, weighted by Whisper’s predicted language probabilities. Dhasmana *et al.* [@dhasmana2026] show for 30 Indic varieties of the Vaani corpus that phylogenetic distance only partly explains cross-lingual transfer, and Kumar *et al.* [@kumar2022] compare ASR for Awadhi, Bhojpuri, Braj and Magahi against a zero-shot Hindi system. For unwritten tribal languages of Karnataka, Rajkhowa *et al.* [@rajkhowa2023] transliterate Lambani and Soliga speech into Kannada script. These works choose or combine languages from linguistic similarity or model probabilities, once and offline.'));
B.push(H2('E', 'Data governance'));
B.push(P('The CARE principles [@carroll] argue that data about Indigenous peoples should serve collective benefit and remain under community authority. Many speech-collection efforts record a single consent that covers all uses. SwaraVeda separates consent to *listen* from consent to *train AI* and enforces both in every query and export.'));
B.push(P('**Gap.** Prior work selects a stand-in language by linguistic similarity or model probabilities. To the best of our knowledge, based on a search of IEEE Xplore, the ACL Anthology and arXiv in November 2026, no prior system selects it from the correction effort of community post-editing or keeps the choice up to date as verified data grows.'));

B.push(H1('III', 'System Design'));
B.push(H2('A', 'Architecture'));
B.push(P('SwaraVeda is a three-tier web application (Fig. 1). A React and TypeScript single-page app runs in the browser; a stateless FastAPI service handles authentication, recordings, review, search and export; PostgreSQL with the pgvector extension and an object store hold the data (Supabase). Speech recognition and translation run through hosted model APIs, so the server needs no GPU.'));
B.push(new Paragraph({ children: [new ImageRun({ data: fs.readFileSync(FIG), type: 'png', transformation: { width: 336, height: 245 }, altText: { title: 'Architecture', description: 'Architectural context diagram of SwaraVeda', name: 'Fig1' } })], alignment: AlignmentType.CENTER, spacing: { before: 80 } }));
B.push(Cap('Fig. 1. Architectural context diagram of SwaraVeda.'));
B.push(H2('B', 'Capture and consent'));
B.push(P('A three-step form records audio with the browser’s MediaRecorder API (or accepts a file) and collects the title, dialect, speaker, genre, place and date. Echo cancellation and noise suppression are disabled, as they distort singing. Two consents are asked separately: whether anyone may listen, and whether the passage may be used to train speech AI. The browser uploads audio directly to storage through a short-lived signed URL. Without a connection, the recording is stored in IndexedDB and uploaded automatically when the browser comes back online; a service worker caches the application so it opens offline.'));
B.push(H2('C', 'Pre-processing'));
B.push(P('Each recording is converted with ffmpeg to 16 kHz mono, filtered with an 80 Hz high-pass filter, normalised to −18 LUFS following EBU R 128 [@ebu], and encoded as 32 kbit/s Opus. In our tests a 2 MB stereo WAV file became 24 KB, about 1% of its size, keeping long recordings under the 25 MB limit of the recognition API.'));
B.push(H2('D', 'Transcription with Vani'));
B.push(P('Transcription runs as a background job whose progress the client polls. The cleaned audio is sent to Whisper large-v3 [@radford] with temperature 0 and segment-level timestamps. Each dialect carries a proxy-language code, which is passed as Whisper’s language parameter (for example Tulu→Kannada, Toda→Tamil, Bhojpuri→Hindi). The resulting segments, each with start time, end time and draft text, are stored. An LLM then offers an English translation and a Latin-script transliteration of each passage on request.'));
B.push(H2('E', 'Correction and verification'));
B.push(P('Every segment moves through three states: *needs correction* (machine draft only), *needs verification* (corrected by a native speaker) and *verified* (approved by a verifier). The recording page plays the audio with the current segment highlighted so speakers correct while listening. Verifiers and administrators are assigned by role-based access control; a recording becomes verified when all of its segments are.'));
B.push(H2('F', 'Search'));
B.push(P('Exact-word search uses PostgreSQL full-text search with the language-neutral *simple* configuration and ts_rank ranking; search by meaning embeds each passage with a multilingual MiniLM sentence encoder [@reimers2019], [@reimers2020] into 384 dimensions and ranks by cosine distance using pgvector [@pgvector]. Results play from the segment’s start time. Privacy rules apply to every query.'));
B.push(H2('G', 'Dataset export'));
B.push(P('Verifiers can export, as JSON Lines or CSV, every verified passage whose speaker consented to AI training. Each row holds the audio link, start and end times, the machine draft, the human correction, the transliteration, the translation, the dialect and the licence. This pairing of draft and correction is what the method in Section IV relies on.'));

B.push(H2('H', 'Proxy-language selection in the archive'));
B.push(P('The method of Section IV is built into the archive. Verifiers see, for every dialect, the character and word error rate between Vani’s drafts and the community’s corrections, start a comparison of candidate languages that runs as a background job (up to 30 corrected passages, verified ones first, with retries when the speech service rate-limits requests), and switch the dialect’s proxy to the best candidate with one click.'));
B.push(H1('IV', 'Correction Effort as a Proxy-Selection Signal'));
B.push(P('Let *d* be a dialect and *L*(*d*) a small set of candidate proxy languages, chosen by script and family (for Tulu, {Kannada, Malayalam}). For a verified segment *s* of dialect *d*, let *r*_{s} be the human correction and *h*_{s}(ℓ) the draft produced with proxy ℓ ∈ *L*(*d*). With ED the Levenshtein edit distance [@levenshtein] over characters, the correction effort of proxy ℓ for dialect *d* is the micro-averaged character error rate:'));
B.push(Eq('C(d, ℓ) = Σ_{s} ED(h_{s}(ℓ), r_{s}) / Σ_{s} |r_{s}|', 1));
B.push(P('computed over all verified segments of *d*. The word error rate W(*d*, ℓ) is defined analogously over words. The archive assigns to each dialect the proxy with the lowest effort:', { noIndent: true }));
B.push(Eq('ℓ*(d) = argmin_{ℓ ∈ L(d)} C(d, ℓ)', 2));
B.push(P('In normal operation each segment is transcribed only with the current proxy, so C(*d*, ℓ) is observed for one ℓ only. To compare candidates, the stored audio of a held-out sample of verified segments is re-transcribed with every ℓ ∈ *L*(*d*), which costs only API calls, since the human reference *r*_{s} already exists. Algorithm 1 summarises the procedure; it is repeated whenever a dialect gains a fixed number of new verified segments, so the hint improves as the archive grows.'));
B.push(new Paragraph({ children: [], spacing: { after: 60 } }));
B.push(boxed([
  '**Algorithm 1** Proxy-language selection from correction effort',
  '**Input:** dialect *d*, candidates *L*(*d*), verified segments *S*_{d}, sample size *n*',
  '1: *T* ← random sample of min(*n*, |*S*_{d}|) segments of *S*_{d}',
  '2: **for each** ℓ ∈ *L*(*d*) ∪ {auto} **do**',
  '3:     **for each** *s* ∈ *T* **do** *h*_{s}(ℓ) ← Whisper(clip(*s*), language = ℓ)',
  '4:     C(*d*, ℓ) ← Σ ED(*h*_{s}(ℓ), *r*_{s}) / Σ |*r*_{s}|   (Eq. 1)',
  '5: ℓ_{best} ← argmin_{ℓ} C(*d*, ℓ);  set the hint of *d* to ℓ_{best}',
  '6: **repeat** when *d* gains *k* new verified segments',
]));
B.push(new Paragraph({ children: [], spacing: { after: 80 } }));
B.push(P('Here “auto” lets Whisper identify the language itself and serves as the no-hint baseline. The method needs no extra labelling: the reference transcripts are the corrections the community makes in any case, and it applies to any dialect as soon as a few passages are verified.'));

B.push(H1('V', 'Evaluation Protocol'));
B.push(P('The archive implements Algorithm 1 (Section III); this section fixes how it is to be evaluated so that results are comparable across dialects. The first targets are Tulu, Kodava and Beary, all three commonly written in Kannada script and with Kannada and Malayalam as candidate proxies, compared against automatic language identification. For each dialect, native speakers record short clips of conversation, narrative and song with both consents and correct and verify the transcripts in SwaraVeda. Every verified clip is transcribed with Whisper large-v3 (temperature 0) under each candidate, and micro-averaged CER and WER (Eq. 1) are computed against the verified corrections after removing punctuation and normalising Unicode to NFC. Because the human references already exist, each comparison costs only |*L*(*d*)| + 1 recognition calls per clip.'));

B.push(H1('VI', 'Results'));
B.push(H2('A', 'Deployed system'));
B.push(...TCap('I', 'Deployed System'));
B.push(table([
  ['Item', 'Value'],
  ['Dialects catalogued', '139, each with script, region, ISO code, proxy hint'],
  ['Audio pre-processing', '2 MB stereo WAV → 24 KB Opus (≈1%)'],
  ['Automated backend tests', '125 passing (SQLite and PostgreSQL)'],
  ['Offline capture', 'IndexedDB queue + service worker'],
  ['Proxy selection', 'Built in: per-dialect CER/WER and comparison of candidates'],
  ['Deployment', 'Vercel (web), Render (API), Supabase (data)'],
], [1740, 3300]));
B.push(new Paragraph({ children: [], spacing: { after: 80 } }));
B.push(P('The system is deployed at swara-veda.vercel.app. End-to-end browser tests on desktop and phone screen sizes completed the full record, transcribe, correct and verify cycle without errors, and recordings made offline were uploaded and transcribed automatically once the connection returned. Automated tests check the selection logic of Algorithm 1: given drafts produced under each candidate, the archive scores them by Eq. (1), ranks them, stores the result and names the candidate with the lowest correction effort.'));

B.push(H1('VII', 'Ethics and Limitations'));
B.push(P('Recordings are private unless the speaker allows public listening, and only passages with explicit AI-training consent are exported. Each passage keeps its licence, and reference recordings from Wikimedia Commons are limited to open licences with attribution. The study has several limitations. The method has not yet been evaluated on field recordings at scale; with few verified passages per dialect, error rates are noisy and the ranking of candidates may change as data grows, which is why the archive repeats the comparison as verified passages accumulate. Re-transcribing with each candidate adds API cost that grows with |*L*(*d*)|. Character error rate assumes a stable orthography, while many dialects have competing spellings, so verifiers’ conventions influence the measure. Finally, the approach depends on hosted models and on sustained community participation.'));

B.push(H1('VIII', 'Conclusion and Future Work'));
B.push(P('SwaraVeda shows that a consent-first community archive can turn the routine work of correcting machine drafts into a measurement that improves the drafts themselves. Using correction effort to choose a proxy language requires no additional labelling and adapts as verified data grows. Future work will fine-tune Whisper on the exported data with low-rank adapters (LoRA) [@hu] and report the reduction in word error rate per dialect, report the proxy-selection results of Section V on field recordings, extend the study to more dialects, add speaker diarisation, and offer the interface in Indian languages.'));

B.push(new Paragraph({ children: [r('Acknowledgment', { sc: true })], alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 } }));
B.push(P('The authors thank the Department of Computer Science and Engineering, RV Institute of Technology and Management, for its support, and the speakers who shared their voices.'));

B.push(new Paragraph({ children: [r('References', { sc: true })], alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 } }));
const REFS = {
  census: 'Office of the Registrar General and Census Commissioner, India, “Census of India 2011: Language, India, States and Union Territories,” Paper 1 of 2018, New Delhi, 2018.',
  unesco: 'C. Moseley, Ed., *Atlas of the World’s Languages in Danger*, 3rd ed. Paris, France: UNESCO Publishing, 2010.',
  radford: 'A. Radford, J. W. Kim, T. Xu, G. Brockman, C. McLeavey, and I. Sutskever, “Robust speech recognition via large-scale weak supervision,” in *Proc. 40th Int. Conf. Machine Learning (ICML)*, PMLR vol. 202, 2023, pp. 28492-28518.',
  pratap: 'V. Pratap *et al.*, “Scaling speech technology to 1,000+ languages,” *J. Machine Learning Research*, vol. 25, no. 97, pp. 1-52, 2024.',
  bird: 'S. Bird, F. R. Hanke, O. Adams, and H. Lee, “Aikuma: A mobile app for collaborative language documentation,” in *Proc. 2014 Workshop on the Use of Computational Methods in the Study of Endangered Languages*, ACL, 2014, pp. 1-5.',
  blachon: 'D. Blachon, E. Gauthier, L. Besacier, G.-N. Kouarata, M. Adda-Decker, and A. Rialland, “Parallel speech collection for under-resourced language studies using the LIG-Aikuma mobile device app,” in *Proc. 5th Workshop on Spoken Language Technologies for Under-Resourced Languages (SLTU)*, *Procedia Computer Science*, vol. 81, 2016.',
  foley: 'B. Foley *et al.*, “Building speech recognition systems for language documentation: The CoEDL Endangered Language Pipeline and Inference System (ELPIS),” in *Proc. 6th Workshop on Spoken Language Technologies for Under-Resourced Languages (SLTU)*, 2018, doi: 10.21437/SLTU.2018-43.',
  povey: 'D. Povey *et al.*, “The Kaldi speech recognition toolkit,” in *Proc. IEEE Workshop on Automatic Speech Recognition and Understanding (ASRU)*, 2011.',
  ardila: 'R. Ardila *et al.*, “Common Voice: A massively-multilingual speech corpus,” in *Proc. 12th Language Resources and Evaluation Conf. (LREC)*, 2020, pp. 4218-4222.',
  abraham: 'B. Abraham *et al.*, “Crowdsourcing speech data for low-resource languages from low-income workers,” in *Proc. 12th Language Resources and Evaluation Conf. (LREC)*, 2020, pp. 2819-2826.',
  javed2023: 'T. Javed, K. Bhogale, A. Raman, P. Kumar, A. Kunchukuttan, and M. M. Khapra, “IndicSUPERB: A speech processing universal performance benchmark for Indian languages,” in *Proc. AAAI Conf. Artificial Intelligence*, vol. 37, no. 11, 2023, pp. 12942-12950.',
  baevski: 'A. Baevski, H. Zhou, A. Mohamed, and M. Auli, “wav2vec 2.0: A framework for self-supervised learning of speech representations,” in *Advances in Neural Information Processing Systems (NeurIPS)*, vol. 33, 2020, pp. 12449-12460.',
  javed2022: 'T. Javed *et al.*, “Towards building ASR systems for the next billion users,” in *Proc. AAAI Conf. Artificial Intelligence*, vol. 36, no. 10, 2022, pp. 10813-10821.',
  carroll: 'S. R. Carroll *et al.*, “The CARE principles for Indigenous data governance,” *Data Science Journal*, vol. 19, no. 1, p. 43, 2020, doi: 10.5334/dsj-2020-043.',
  ebu: 'European Broadcasting Union, “EBU R 128: Loudness normalisation and permitted maximum level of audio signals,” Geneva, Switzerland, 2020.',
  reimers2019: 'N. Reimers and I. Gurevych, “Sentence-BERT: Sentence embeddings using Siamese BERT-networks,” in *Proc. EMNLP-IJCNLP*, 2019, pp. 3982-3992.',
  reimers2020: 'N. Reimers and I. Gurevych, “Making monolingual sentence embeddings multilingual using knowledge distillation,” in *Proc. EMNLP*, 2020, pp. 4512-4525.',
  pgvector: 'pgvector: Open-source vector similarity search for Postgres. [Online]. Available: https://github.com/pgvector/pgvector',
  levenshtein: 'V. I. Levenshtein, “Binary codes capable of correcting deletions, insertions, and reversals,” *Soviet Physics Doklady*, vol. 10, no. 8, pp. 707-710, 1966.',
  hu: 'E. J. Hu *et al.*, “LoRA: Low-rank adaptation of large language models,” in *Proc. Int. Conf. Learning Representations (ICLR)*, 2022.',
  sravaani: 'ARTPARK and Indian Institute of Science, “SraVaani: Speech recognition for Indian languages,” model card. [Online]. Available: https://huggingface.co/ARTPARK-IISc/SraVaani',
  huang2025: 'S.-S. Huang, K.-P. Huang, A. T. Liu, and H.-y. Lee, “Enhancing multilingual ASR for unseen languages via language embedding modeling,” in *Proc. IEEE Int. Conf. Acoustics, Speech and Signal Processing (ICASSP)*, 2025.',
  dhasmana2026: 'A. Dhasmana, A. Srivastava, and D. Chiang, “Dialect matters: Cross-lingual ASR transfer for low-resource Indic language varieties,” in *Proc. VarDial Workshop*, 2026, pp. 145-156.',
  kumar2022: 'R. Kumar *et al.*, “Annotated speech corpus for low resource Indian languages: Awadhi, Bhojpuri, Braj and Magahi,” in *Proc. Speech for Social Good Workshop, Interspeech*, 2022.',
  rajkhowa2023: 'T. Rajkhowa, A. Chowdhury, P. Bannulmath, D. K. T., and S. R. M. Prasanna, “Optimizing direct speech-to-text translation for un-orthographic low-resource tribal languages using source transliterations,” in *Proc. 26th Conf. Oriental COCOSDA (O-COCOSDA)*, 2023, doi: 10.1109/O-COCOSDA60357.2023.10482960.',
};
const uncited = Object.keys(REFS).filter((k) => !CITED.includes(k));
if (uncited.length) throw new Error(`References never cited: ${uncited.join(', ')}`);
CITED.forEach((k, i) => B.push(new Paragraph({
  children: [r(`[${i + 1}]`, { size: 16 }), new TextRun({ text: '\t', font: F, size: 16 }), ...runs(REFS[k], 16)],
  tabStops: [{ type: TabStopType.LEFT, position: 360 }], indent: { left: 360, hanging: 360 },
  alignment: AlignmentType.BOTH, spacing: { after: 20 },
})));

const doc = new Document({
  creator: 'SwaraVeda team', title: 'SwaraVeda NCDTE 2026 paper',
  styles: { default: { document: { run: { font: F, size: 20 } } } },
  numbering: { config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 288, hanging: 180 } } } }] },
    { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1)', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 288, hanging: 216 } } } }] },
  ] },
  sections: [
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1440, left: 900, right: 900 } } }, children: front },
    { properties: { type: SectionType.CONTINUOUS, column: { count: 2, space: 360 }, page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1440, left: 900, right: 900 } } }, children: B },
  ],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log('wrote', OUT); });
