/**
 * TOS Parser Service
 * Extracts text and structured data from PDF, DOCX, XLSX files.
 * Parses Table of Specifications (TOS) to feed AI with hard constraints:
 * - Cognitive Levels (Bloom's Taxonomy: Remembering, Understanding, Applying, Analyzing, Evaluating, Creating)
 * - Item Placement (exact item numbers per topic and cognitive level)
 * - Topics per item
 * - Points per item
 */

import { geminiEndpoint, isGeminiAvailable } from './geminiEndpoint';

export interface TOSItemSpec {
  itemNumber: number;
  topic: string;
  cognitiveLevel: string;
  points: number;
  questionType?: string;
}

export interface TOSRow {
  topic: string;
  cognitiveLevel: string;
  itemCount: number;
  itemPlacement?: string;
  points: number;
  questionType?: string;
}

export interface TOSData {
  rawText: string;
  fileName: string;
  courseTitle?: string;
  topics?: string[];
  rows: TOSRow[];
  itemSpecs: TOSItemSpec[];
  totalItems: number;
  totalPoints: number;
  cognitiveBreakdown: Record<string, number>;
  cognitiveLevels?: Record<string, number>;
  questionTypeBreakdown: Record<string, number>;
  topicBreakdown: Record<string, number>;
  parsedSuccessfully: boolean;
}

export const BLOOM_LEVELS = [
  'Remembering',
  'Understanding',
  'Applying',
  'Analyzing',
  'Evaluating',
  'Creating',
  'Remembering / Understanding',
  'Applying / Analyzing',
  'Synthesizing / Evaluating',
] as const;

export type BloomLevel = typeof BLOOM_LEVELS[number];

/**
 * Common administrative metadata keywords found in university TOS documents
 * (e.g. OMSC / Philippine HEI Table of Specifications headers and footers).
 * These MUST be filtered out and never treated as exam topics.
 */
const ADMINISTRATIVE_KEYWORDS = [
  'effectivity date',
  'revision no',
  'revision number',
  'document no',
  'form no',
  'prepared by',
  'approved by',
  'reviewed by',
  'checked by',
  'noted by',
  'instructor',
  'professor',
  'dean',
  'chairperson',
  'campus',
  'college of',
  'department of',
  'academic year',
  'semester',
  'school year',
  'page 1 of',
  'page 2 of',
  'page 3 of',
  'page 4 of',
  'page 5 of',
  'omsc',
  'state college',
  'university',
  'table of specification',
  'table of specifications',
  'course syllabus',
  'curriculum',
  'contact hours',
  'credit units',
  'course code',
  'date prepared',
  'date approved',
  'date effective',
];

export function isAdministrativeMetadata(str: string): boolean {
  if (!str) return false;
  const lc = str.trim().toLowerCase();
  if (/^march\s+\d{1,2}(?:,\s*\d{4})?$/i.test(lc)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(lc)) return true;
  if (/^(?:page|rev|doc|form)\s*[:#\d]/i.test(lc)) return true;
  return ADMINISTRATIVE_KEYWORDS.some((kw) => lc.includes(kw));
}

/**
 * Normalises a raw text cell into a recognised Bloom's Cognitive Level.
 * Uses strict token matching to prevent false positives from everyday words.
 */
export function normaliseCogLevel(raw: string): string {
  if (!raw) return '';
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  // 1. Compound / Grouped Bloom levels (common in Philippine HEI TOS formats)
  if (
    (clean.includes('remember') && clean.includes('understand')) ||
    (clean.includes('knowledge') && clean.includes('comprehension')) ||
    clean === 'rem/und' || clean === 'rem und' || clean === 'r/u' || clean === 'r u'
  ) {
    return 'Remembering / Understanding';
  }

  if (
    (clean.includes('appl') && clean.includes('analy')) ||
    (clean.includes('application') && clean.includes('analysis')) ||
    clean === 'app/ana' || clean === 'app ana' || clean === 'ap/an'
  ) {
    return 'Applying / Analyzing';
  }

  if (
    ((clean.includes('synth') || clean.includes('creat')) && (clean.includes('eval') || clean.includes('evaluation'))) ||
    clean === 'syn/eva' || clean === 'syn eva' || clean === 'cre/eva' || clean === 'eval/syn'
  ) {
    return 'Synthesizing / Evaluating';
  }

  // 2. Exact word / token matching
  const tokens = clean.split(/[\s/]+/);
  for (const t of tokens) {
    if (t === 'remembering' || t === 'remember' || t === 'recall' || t === 'knowledge' || t === 'rem' || t === 'r') return 'Remembering';
    if (t === 'understanding' || t === 'understand' || t === 'comprehension' || t === 'comprehend' || t === 'und' || t === 'u') return 'Understanding';
    if (t === 'applying' || t === 'apply' || t === 'application' || t === 'app' || t === 'ap') return 'Applying';
    if (t === 'analyzing' || t === 'analyse' || t === 'analyze' || t === 'analysis' || t === 'ana' || t === 'an') return 'Analyzing';
    if (t === 'evaluating' || t === 'evaluate' || t === 'evaluation' || t === 'eval' || t === 'eva' || t === 'ev' || t === 'e') return 'Evaluating';
    if (t === 'creating' || t === 'create' || t === 'creation' || t === 'synthesis' || t === 'synthesizing' || t === 'cre' || t === 'syn' || t === 'c' || t === 'cr') return 'Creating';
  }

  // 3. Prefix matching only for substantive tokens (>= 5 chars) to prevent false positives
  for (const t of tokens) {
    if (t.length >= 5) {
      if (t.startsWith('rememb') || t.startsWith('knowledg')) return 'Remembering';
      if (t.startsWith('underst') || t.startsWith('comprehen')) return 'Understanding';
      if (t.startsWith('applic') || t.startsWith('apply')) return 'Applying';
      if (t.startsWith('analy')) return 'Analyzing';
      if (t.startsWith('evalu')) return 'Evaluating';
      if (t.startsWith('creat') || t.startsWith('synthes')) return 'Creating';
    }
  }

  return '';
}

/**
 * Coordinate-aware PDF text extraction.
 * Preserves horizontal table column relationships using X/Y geometry.
 */
async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // The worker is bundled rather than pulled from a CDN. Loading it from jsdelivr made
      // every PDF upload depend on a third-party host being reachable: behind a school
      // proxy, or on a restricted network, extraction failed with nothing but "no readable
      // text", which looks like a broken file rather than a blocked request.
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const textItems = content.items.filter((item: any) => 'str' in item && item.str && item.str.trim());

      // Group items by Y coordinate (within 4px) to reconstruct lines
      const linesMap: { y: number; items: { x: number; str: string }[] }[] = [];
      for (const item of textItems) {
        const x = item.transform[4];
        const y = Math.round(item.transform[5]);
        let line = linesMap.find((l) => Math.abs(l.y - y) <= 4);
        if (!line) {
          line = { y, items: [] };
          linesMap.push(line);
        }
        line.items.push({ x, str: item.str });
      }

      // Sort lines top to bottom (PDF Y is bottom-up, so descending Y = top to bottom)
      linesMap.sort((a, b) => b.y - a.y);

      const pageLines: string[] = [];
      for (const line of linesMap) {
        // Sort items left to right
        line.items.sort((a, b) => a.x - b.x);
        let lineStr = '';
        let lastX = -1;
        for (const item of line.items) {
          if (lastX >= 0) {
            const gap = item.x - lastX;
            if (gap > 16) {
              lineStr += '\t|\t'; // Column delimiter
            } else if (gap > 3) {
              lineStr += ' ';
            }
          }
          lineStr += item.str;
          lastX = item.x + Math.max(8, item.str.length * 5.5);
        }
        if (lineStr.trim()) pageLines.push(lineStr.trim());
      }

      pages.push(pageLines.join('\n'));
    }

    return pages.join('\n\n');
  } catch (err) {
    console.warn('[TOSParser] PDF extraction failed:', err);
    return '';
  }
}

/**
 * Word DOCX extraction preserving table rows and columns using mammoth HTML conversion.
 */
async function extractDocxText(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();

    const htmlResult = await (mammoth as any).convertToHtml({ arrayBuffer });
    const html = htmlResult.value || '';

    if (html.includes('<table')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const tableLines: string[] = [];

      const tables = doc.querySelectorAll('table');
      tables.forEach((tbl) => {
        const rows = tbl.querySelectorAll('tr');
        rows.forEach((r) => {
          const cells = Array.from(r.querySelectorAll('th, td')).map((c) => (c.textContent || '').trim());
          if (cells.some(Boolean)) {
            tableLines.push(cells.join('\t|\t'));
          }
        });
        tableLines.push('');
      });

      const paragraphs = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
        .map((p) => (p.textContent || '').trim())
        .filter(Boolean);

      return `${paragraphs.join('\n')}\n\n=== TABLES ===\n${tableLines.join('\n')}`;
    }

    const rawResult = await (mammoth as any).extractRawText({ arrayBuffer });
    return rawResult.value || '';
  } catch (err) {
    console.warn('[TOSParser] DOCX extraction failed:', err);
    return '';
  }
}

/**
 * Excel extraction converting sheets to 2D arrays and structured text.
 */
async function extractXlsxData(file: File): Promise<{ text: string; sheetsData: { name: string; rows: string[][] }[] }> {
  try {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetsText: string[] = [];
    const sheetsData: { name: string; rows: string[][] }[] = [];

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet, { forceQuotes: false });
      sheetsText.push(`[Sheet: ${name}]\n${csv}`);
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      const strRows = rawRows.map((r) => r.map((c) => String(c ?? '').trim()));
      sheetsData.push({ name, rows: strRows });
    }
    return { text: sheetsText.join('\n\n'), sheetsData };
  } catch (err) {
    console.warn('[TOSParser] XLSX extraction failed:', err);
    return { text: '', sheetsData: [] };
  }
}

/**
 * PowerPoint (.pptx) text, slide by slide in presentation order, with speaker notes.
 * A .pptx is a zip of XML parts; text runs are <a:t> elements and paragraphs end at </a:p>.
 * Old binary .ppt files cannot be read in the browser and return ''.
 */
async function extractPptxText(file: File): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const decode = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    // One line per paragraph: the text runs (<a:t>) inside each <a:p>, joined in order.
    const xmlText = (xml: string) => (xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) || [])
      .map((para) => (para.match(/<a:t>([^<]*)<\/a:t>/g) || []).map((r) => decode(r.slice(5, -6))).join('').trim())
      .filter(Boolean)
      .join('\n');
    const num = (path: string) => Number(path.match(/(\d+)\.xml$/)?.[1] || 0);
    const slides = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => num(a) - num(b));
    const out: string[] = [];
    for (const path of slides) {
      const n = num(path);
      const body = xmlText(await zip.file(path)!.async('string'));
      const notesFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
      const notes = notesFile ? xmlText(await notesFile.async('string')).replace(/^\d+$/gm, '').trim() : '';
      if (body || notes) out.push(`--- Slide ${n} ---\n${body}${notes ? `\nSpeaker notes: ${notes}` : ''}`);
    }
    return out.join('\n\n');
  } catch (err) {
    console.warn('[TOSParser] PPTX extraction failed:', err);
    return '';
  }
}

export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return extractPdfText(file);
  if (name.endsWith('.pptx')) return extractPptxText(file);
  if (name.endsWith('.docx') || name.endsWith('.doc')) return extractDocxText(file);
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) {
    const res = await extractXlsxData(file);
    return res.text;
  }
  if (file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.md') || name.endsWith('.json')) {
    return file.text();
  }
  return '';
}

/**
 * Parses item range strings like "1-5", "1 - 5", "1,2,3", "1, 2, 3", "1 to 5", "10"
 * Returns list of discrete integer item numbers.
 */
/**
 * Expand a TOS "Item Placement" cell into the individual item numbers it denotes.
 *
 * Real TOS documents write placements as "(1-2)", "(3-9)", "19–28", "35", "1 to 5",
 * "2 (1-2)" (count and placement in one cell), "1-3, 7; 9". The previous implementation
 * anchored its range regex as /^(\d+)-(\d+)$/, so ANY bracketed or decorated token failed to
 * match and fell through to a digit-strip — turning "(1-2)" into the single item 12,
 * "(3-9)" into 39 and "(19-28)" into 1928. Each cognitive cell then yielded exactly one
 * item, collapsing a 60-item blueprint to about 12 specs.
 *
 * This version scans for range and singleton patterns ANYWHERE in the cell, which is robust
 * to brackets, dashes of every flavour, and a leading count.
 */
function parseItemPlacementNumbers(placementStr: string): number[] {
  if (!placementStr) return [];

  const clean = String(placementStr)
    .replace(/ /g, ' ')            // non-breaking space
    .replace(/[‐-―−]/g, '-') // figure dash, en/em dash, minus -> hyphen
    .replace(/\s*\bto\b\s*/gi, '-')     // "1 to 5" -> "1-5"; global, not just the first
    .replace(/\s*\bthru\b\s*|\s*\bthrough\b\s*/gi, '-')
    .trim();

  const seen = new Set<number>();
  const items: number[] = [];
  const push = (n: number) => {
    if (Number.isFinite(n) && n > 0 && n <= 1000 && !seen.has(n)) {
      seen.add(n);
      items.push(n);
    }
  };

  // Pass 1: ranges anywhere in the string, e.g. "(19-28)" or "items 3 - 9".
  const rangeRe = /(\d+)\s*-\s*(\d+)/g;
  const consumed: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(clean)) !== null) {
    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    if (!isNaN(start) && !isNaN(end) && start <= end && end - start <= 200) {
      for (let i = start; i <= end; i++) push(i);
      consumed.push([m.index, m.index + m[0].length]);
    }
  }

  // Pass 2: standalone numbers not already inside a matched range, e.g. the bare "35",
  // or the "7" in "1-3, 7". A leading count such as the "2" in "2 (1-2)" is NOT treated as
  // a placement, because the bracketed range it labels has already been consumed and a
  // count always precedes its own range.
  const singleRe = /\d+/g;
  while ((m = singleRe.exec(clean)) !== null) {
    const at = m.index;
    if (consumed.some(([s, e]) => at >= s && at < e)) continue;
    // Skip a number immediately followed by an already-consumed range — that is its count.
    const trailing = clean.slice(at + m[0].length);
    if (/^\s*[(\[]?\s*\d+\s*-\s*\d+/.test(trailing)) continue;
    push(parseInt(m[0], 10));
  }

  return items.sort((a, b) => a - b);
}

function detectQuestionType(str: string): string | undefined {
  const lc = str.toLowerCase();
  if (lc.includes('multiple choice') || lc === 'mc' || lc.includes('mult choice')) return 'multiple-choice';
  if ((lc.includes('true') && lc.includes('false')) || lc === 't/f' || lc === 'tf') return 'true-false';
  if (lc.includes('short answer') || lc === 'sa' || lc.includes('identification') || lc.includes('fill')) return 'short-answer';
  if (lc.includes('essay') || lc.includes('open') || lc.includes('long response') || lc.includes('problem')) return 'essay';
  return undefined;
}

/**
 * Parses structured 2D table grid (from Excel, DOCX, or coordinate-aligned PDF).
 * Handles matrix-based TOS where Bloom cognitive levels are column headers.
 */
function parseMatrixTable(rows: string[][]): TOSRow[] {
  if (rows.length < 2) return [];

  // Search up to 35 rows for the table header row containing Bloom cognitive levels
  let headerRowIdx = -1;
  const bloomColMap: Record<number, string> = {};
  let placementColIdx = -1;
  let pointsColIdx = -1;
  let topicColIdx = 0;

  for (let r = 0; r < Math.min(rows.length, 35); r++) {
    const row = rows[r];
    let bloomFound = 0;
    const tempBloomMap: Record<number, string> = {};

    for (let c = 0; c < row.length; c++) {
      const cellText = row[c].trim();
      if (!cellText || isAdministrativeMetadata(cellText)) continue;

      const norm = normaliseCogLevel(cellText);
      if (norm) {
        tempBloomMap[c] = norm;
        bloomFound++;
      } else {
        const lc = cellText.toLowerCase();
        if (lc.includes('placement') || lc.includes('item no') || lc.includes('item #') || lc.includes('test item')) placementColIdx = c;
        if (lc.includes('point') || lc.includes('score') || lc.includes('weight')) pointsColIdx = c;
        if (lc.includes('topic') || lc.includes('competenc') || lc.includes('content') || lc.includes('objective') || lc.includes('subject matter') || lc.includes('outcomes')) topicColIdx = c;
      }
    }

    if (bloomFound >= 2) {
      headerRowIdx = r;
      Object.assign(bloomColMap, tempBloomMap);
      break;
    }
  }

  const parsedRows: TOSRow[] = [];

  // Case 1: Matrix table with Bloom headers
  if (headerRowIdx >= 0 && Object.keys(bloomColMap).length >= 2) {
    let lastActiveTopic = '';
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 2) continue;
      const joined = row.join(' ').toLowerCase();
      if (joined.includes('total') && !joined.includes('subtotal')) continue;
      if (isAdministrativeMetadata(joined)) continue;

      let topic = (row[topicColIdx] || '').trim();
      if (!topic || /^\d+$/.test(topic) || isAdministrativeMetadata(topic)) {
        // Look for the first genuine text cell
        for (let c = 0; c < row.length; c++) {
          const val = row[c].trim();
          if (!bloomColMap[c] && c !== placementColIdx && c !== pointsColIdx && val.length > 3 && !/^\d+$/.test(val) && !isAdministrativeMetadata(val)) {
            topic = val;
            break;
          }
        }
      }

      // If topic is empty in vertically merged rows, inherit previous active topic
      if (!topic && lastActiveTopic) {
        topic = lastActiveTopic;
      } else if (topic && !isAdministrativeMetadata(topic)) {
        lastActiveTopic = topic;
      }

      if (!topic || isAdministrativeMetadata(topic)) continue;

      // Extract points
      let points = 1;
      if (pointsColIdx >= 0 && row[pointsColIdx]) {
        const ptsVal = parseInt(row[pointsColIdx].replace(/[^0-9]/g, ''), 10);
        if (!isNaN(ptsVal) && ptsVal > 0) points = ptsVal;
      }

      // Check each cognitive column for items
      for (const [colStr, cogLevel] of Object.entries(bloomColMap)) {
        const c = parseInt(colStr, 10);
        const cellVal = (row[c] || '').trim();
        if (!cellVal || cellVal === '0' || cellVal === '-' || cellVal === 'N/A') continue;

        const discreteItems = parseItemPlacementNumbers(cellVal);
        let itemCount = 0;
        let placement = '';

        if (discreteItems.length > 0) {
          itemCount = discreteItems.length;
          placement = cellVal;
        } else {
          const num = parseInt(cellVal.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num) && num > 0) {
            itemCount = num;
          }
        }

        if (itemCount > 0) {
          parsedRows.push({
            topic,
            cognitiveLevel: cogLevel,
            itemCount,
            points,
            itemPlacement: placement || undefined,
          });
        }
      }
    }

    if (parsedRows.length > 0) return parsedRows;
  }

  // Case 2: Row-based table (cognitive level per row)
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < 2) continue;
    const joined = row.join(' ').toLowerCase();
    if (joined.includes('total') && !joined.includes('subtotal')) continue;
    if (isAdministrativeMetadata(joined)) continue;

    let cogLevel = '';
    let cogIdx = -1;
    for (let c = 0; c < row.length; c++) {
      const norm = normaliseCogLevel(row[c]);
      if (norm) {
        cogLevel = norm;
        cogIdx = c;
        break;
      }
    }

    let topic = '';
    for (let c = 0; c < row.length; c++) {
      if (c === cogIdx) continue;
      const t = row[c].trim();
      if (t.length > 3 && !/^\d+$/.test(t) && !/^\d+\s*[-–—]\s*\d+$/.test(t) && !isAdministrativeMetadata(t)) {
        topic = t;
        break;
      }
    }

    let itemCount = 0;
    let placement = '';
    let qType: string | undefined;

    for (let c = 0; c < row.length; c++) {
      if (c === cogIdx) continue;
      const detectedType = detectQuestionType(row[c]);
      if (detectedType) qType = detectedType;

      const nums = parseItemPlacementNumbers(row[c]);
      if (nums.length > 0 && nums.length > itemCount) {
        itemCount = nums.length;
        placement = row[c].trim();
      }
    }

    if (itemCount === 0) {
      for (let c = 0; c < row.length; c++) {
        if (c === cogIdx) continue;
        const num = parseInt(row[c].replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > 0 && num <= 100) {
          itemCount = num;
          break;
        }
      }
    }

    if (topic && !isAdministrativeMetadata(topic) && itemCount > 0) {
      parsedRows.push({
        topic,
        cognitiveLevel: cogLevel || 'Applying',
        itemCount,
        itemPlacement: placement || undefined,
        points: 1,
        questionType: qType,
      });
    }
  }

  return parsedRows;
}

/**
 * Parses raw text lines (from PDF, Word, or plain text) into TOS rows.
 */
/** The three grouped Bloom bands used by the OMSC form, in column order. */
const PAIRED_BLOOM_COLUMNS = [
  'Remembering / Understanding',
  'Applying / Analyzing',
  'Synthesizing / Evaluating',
];

/** Columns are delimited by the "\t|\t" marker inserted during PDF extraction. */
function splitColumns(line: string): string[] {
  return line.split('\t|\t').map((c) => c.trim()).filter(Boolean);
}

const INT_CELL = /^\d+$/;
const PCT_CELL = /^\d+(?:\.\d+)?\s*%$/;
/** "(1-2)", "(19–28)", "35" — a single item number or an inclusive range. */
const PLACEMENT_CELL = /^\(?\s*\d+\s*(?:[-–—]\s*\d+\s*)?\)?$/;
const PLACEMENT_RANGE = /\d+\s*[-–—]\s*\d+/;

/**
 * A counts row ends with the three cognitive-level tallies and carries a percentage
 * cell (the topic's share of contact hours), e.g.
 *   "...Database Integration | 10 | 23% | 14 | 2 | 7 | 4"
 */
function isCountsRow(cells: string[]): boolean {
  if (cells.length < 4) return false;
  const tail = cells.slice(-3);
  return tail.every((c) => INT_CELL.test(c)) && cells.some((c) => PCT_CELL.test(c));
}

/**
 * The topic title is glued onto the end of the learning-outcome prose when the PDF's
 * columns are flattened ("...full-stackdevelopment,Database Integration",
 * "...including frontendMobile Frontend: React Native"). It is the trailing
 * capitalised phrase, which starts either after a comma or at a lowercase->uppercase
 * seam where the two columns ran together.
 */
function extractTopicName(prose: string): string {
  const match = prose.match(/(?:^|,\s*|[a-z])([A-Z][A-Za-z0-9 :/&'’.\-]*?)\s*$/);
  return (match ? match[1] : prose).replace(/[•●]/g, '').trim();
}

/**
 * Parses the "Cognitive Levels and Item Placement" matrix of the OMSC TOS form
 * (OMSC-Form-COL-25) and the Philippine HEI forms that share its shape.
 *
 * Each topic spans TWO physical lines once the PDF is flattened to text — the tallies
 * on one, the item placements they label on the next:
 *
 *   "<learning outcomes><Topic> | 10 | 23% | 14 | 2 | 7 | 4"
 *   "<more outcome prose>       | (1-2) | (3-9) | (10-13)"
 *
 * A row-at-a-time parser therefore never joins a tally to its placement. Splitting on
 * commas as well as the column delimiter compounds this, because the prose in the first
 * cell is full of commas and shredding it destroys the column alignment entirely.
 *
 * The per-topic "Number of Items" column is NOT used: on real forms it disagrees with
 * the cognitive columns it summarises (this one totals 61 against a stated 60). The
 * cognitive tallies and their placements agree with each other and with the Total row,
 * so they are treated as authoritative.
 */
function parseOmscMatrixRows(text: string): TOSRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: TOSRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cells = splitColumns(lines[i]);
    if (!isCountsRow(cells)) continue;
    if (/^total\b/i.test(cells[0])) continue; // the summary row, not a topic

    const topic = extractTopicName(cells[0]);
    if (!topic || isAdministrativeMetadata(topic)) continue;

    const counts = cells.slice(-3).map(Number);

    // The placements sit on a following line, before the next topic begins.
    let placements: string[] = [];
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const next = splitColumns(lines[j]);
      if (isCountsRow(next)) break;
      const candidates = next.filter((c) => PLACEMENT_CELL.test(c));
      if (candidates.length >= 2 && candidates.some((c) => PLACEMENT_RANGE.test(c))) {
        placements = candidates.slice(-3);
        break;
      }
    }

    // Align placements to the levels that actually carry items, so a zero-item band
    // cannot shift every later placement onto the wrong cognitive level.
    const levelsWithItems = counts.map((n, idx) => ({ n, idx })).filter((c) => c.n > 0);
    const aligned: (string | undefined)[] = [undefined, undefined, undefined];
    if (placements.length === counts.length) {
      placements.forEach((p, idx) => { aligned[idx] = p; });
    } else {
      levelsWithItems.forEach((c, k) => { aligned[c.idx] = placements[k]; });
    }

    counts.forEach((count, idx) => {
      if (count <= 0) return;
      rows.push({
        topic,
        cognitiveLevel: normaliseCogLevel(PAIRED_BLOOM_COLUMNS[idx]) || PAIRED_BLOOM_COLUMNS[idx],
        itemCount: count,
        itemPlacement: aligned[idx],
        points: 1,
      });
    });
  }

  return rows;
}

export function parseRowsFromText(text: string): TOSRow[] {
  // Prefer the structured matrix reader; it understands the two-line topic layout that
  // the generic cell splitter below cannot represent.
  const matrixRows = parseOmscMatrixRows(text);
  if (matrixRows.length > 0) return matrixRows;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tableRows: string[][] = [];
  for (const line of lines) {
    if (isAdministrativeMetadata(line)) continue;
    const cells = line.split(/[,\t|]| {2,}/).map((c) => c.trim()).filter(Boolean);
    if (cells.length > 0) tableRows.push(cells);
  }
  return parseMatrixTable(tableRows);
}

/**
 * Builds an exact, item-by-item placement mapping:
 * Item 1 -> Topic, Cognitive Level, Points
 * Item 2 -> Topic, Cognitive Level, Points
 */
export function buildItemSpecs(rows: TOSRow[]): TOSItemSpec[] {
  const specs: TOSItemSpec[] = [];
  const assignedItemNums = new Set<number>();

  // 1. Process rows that already have explicit item placement numbers (e.g. "1-5", "6-10")
  for (const row of rows) {
    if (row.itemPlacement) {
      const itemNums = parseItemPlacementNumbers(row.itemPlacement);
      for (const num of itemNums) {
        specs.push({
          itemNumber: num,
          topic: row.topic,
          cognitiveLevel: row.cognitiveLevel,
          points: row.points || 1,
          questionType: row.questionType,
        });
        assignedItemNums.add(num);
      }
    }
  }

  // 2. Process rows without explicit placement by assigning sequential item numbers
  let nextItemNum = 1;
  for (const row of rows) {
    if (!row.itemPlacement || parseItemPlacementNumbers(row.itemPlacement).length === 0) {
      for (let i = 0; i < row.itemCount; i++) {
        while (assignedItemNums.has(nextItemNum)) {
          nextItemNum++;
        }
        specs.push({
          itemNumber: nextItemNum,
          topic: row.topic,
          cognitiveLevel: row.cognitiveLevel,
          points: row.points || 1,
          questionType: row.questionType,
        });
        assignedItemNums.add(nextItemNum);
        nextItemNum++;
      }
    }
  }

  // Sort strictly by item number 1, 2, 3...
  specs.sort((a, b) => a.itemNumber - b.itemNumber);

  // Normalize item numbers to ensure consecutive 1..N sequence if there were gaps
  return specs.map((s, idx) => ({
    ...s,
    itemNumber: idx + 1,
  }));
}

/**
 * Uses Google Gemini AI to analyze raw TOS text and extract the academic inventory.
 * Strictly ignores administrative metadata (Effectivity Date, Form No, Prepared by, etc.).
 */
export async function analyzeTOSWithAI(rawText: string, apiKey?: string): Promise<Partial<TOSData> | null> {
  const key = (apiKey || (typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : '') || '').trim();
  if (!rawText || rawText.trim().length < 40) return null;
  if (!isGeminiAvailable(key)) return null;

  const prompt = `[MANDATORY STEP 1: TOS ANALYSIS & INVENTORY]
You are an expert university curriculum auditor.
Thoroughly examine this official Table of Specifications (TOS) document text.

CRITICAL ANTI-HALLUCINATION RULES:
1. FILTER OUT ALL ADMINISTRATIVE METADATA:
   - Completely ignore "Effectivity Date", "Revision No", "Form No", "Prepared by", "Approved by", "Document No", "OMSC", "Page X of Y", instructor names, or college headers.
   - NEVER treat administrative text (like "March 01, 2024" or "Effectivity Date") as a course topic or question item!
2. IDENTIFY THE TRUE ACADEMIC COURSE:
   - Identify the course title (e.g. "Integrative Programming and Technologies 2").
3. EXTRACT THE EXACT ACADEMIC BLUEPRINT:
   - Identify the substantive academic topics/units/modules (e.g. REST Web Services, Middleware, Integration Architecture, Database Pooling, etc.).
   - Extract the total number of questions specified in the TOS (e.g. 50 items, 30 items, etc.).
   - Map each item to its Bloom's Taxonomy Cognitive Level (Remembering, Understanding, Applying, Analyzing, Evaluating, Creating, or grouped levels like Remembering/Understanding, Applying/Analyzing, Synthesizing/Evaluating).
   - Generate sequential item specifications from Item 1 up to the total item count.

TOS Document Text:
"""
${rawText.slice(0, 16000)}
"""

Respond ONLY with valid JSON matching this schema:
{
  "courseTitle": "Course Name",
  "totalItems": 50,
  "totalPoints": 50,
  "cognitiveBreakdown": {
    "Remembering": 10,
    "Understanding": 10,
    "Applying": 15,
    "Analyzing": 10,
    "Evaluating": 3,
    "Creating": 2
  },
  "topics": [
    "Topic 1 Name",
    "Topic 2 Name"
  ],
  "itemSpecs": [
    {
      "itemNumber": 1,
      "topic": "Academic Topic 1",
      "cognitiveLevel": "Remembering",
      "points": 1,
      "questionType": "multiple-choice"
    }
  ]
}`;

  const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];

  for (const modelCandidate of modelsToTry) {
    try {
      const url = geminiEndpoint(modelCandidate, key);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 40000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawRes = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = rawRes.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed) {
          // If itemSpecs is missing or incomplete, synthesize from topics and cognitiveBreakdown
          const cleanTopics = (parsed.topics || []).filter((t: string) => !isAdministrativeMetadata(t));
          const numItems = Number(parsed.totalItems) || (Array.isArray(parsed.itemSpecs) ? parsed.itemSpecs.length : 0);

          if ((!parsed.itemSpecs || parsed.itemSpecs.length < 5) && numItems > 0 && cleanTopics.length > 0) {
            const breakdown = parsed.cognitiveBreakdown || {
              'Remembering': Math.ceil(numItems * 0.25),
              'Understanding': Math.ceil(numItems * 0.25),
              'Applying': Math.ceil(numItems * 0.3),
              'Analyzing': Math.floor(numItems * 0.2),
            };

            const synthSpecs: TOSItemSpec[] = [];
            let itemIdx = 1;
            for (const [cog, count] of Object.entries(breakdown)) {
              for (let i = 0; i < Number(count) && itemIdx <= numItems; i++) {
                synthSpecs.push({
                  itemNumber: itemIdx,
                  topic: cleanTopics[(itemIdx - 1) % cleanTopics.length],
                  cognitiveLevel: normaliseCogLevel(cog) || 'Understanding',
                  points: 1,
                  questionType: 'multiple-choice',
                });
                itemIdx++;
              }
            }
            while (itemIdx <= numItems) {
              synthSpecs.push({
                itemNumber: itemIdx,
                topic: cleanTopics[(itemIdx - 1) % cleanTopics.length],
                cognitiveLevel: 'Applying',
                points: 1,
                questionType: 'multiple-choice',
              });
              itemIdx++;
            }
            parsed.itemSpecs = synthSpecs;
          }

          if (Array.isArray(parsed.itemSpecs) && parsed.itemSpecs.length > 0) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn(`[TOSParser] AI TOS analysis attempt on ${modelCandidate} failed:`, err);
    }
  }
  return null;
}

/**
 * Parses an uploaded TOS file (Excel, Word, PDF, CSV, TXT) into a structured blueprint.
 */
export async function parseTOSFile(file: File, apiKey?: string): Promise<TOSData> {
  const name = file.name.toLowerCase();
  let rawText = '';
  let rows: TOSRow[] = [];

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) {
    const xlsxRes = await extractXlsxData(file);
    rawText = xlsxRes.text;
    for (const sheet of xlsxRes.sheetsData) {
      const sheetRows = parseMatrixTable(sheet.rows);
      if (sheetRows.length > 0) {
        rows.push(...sheetRows);
      }
    }
  } else {
    rawText = await extractFileText(file);
    if (rawText.trim()) {
      rows = parseRowsFromText(rawText);
    }
  }

  // 1. Attempt AI analysis if rawText was retrieved and API key is available
  if (rawText && rawText.trim().length > 40) {
    const aiParsed = await analyzeTOSWithAI(rawText, apiKey);
    if (aiParsed && aiParsed.itemSpecs && aiParsed.itemSpecs.length > 0) {
      const validSpecs = aiParsed.itemSpecs
        .filter((s) => !isAdministrativeMetadata(s.topic))
        .map((s, idx) => ({
          itemNumber: s.itemNumber || idx + 1,
          topic: s.topic || 'Core Subject Matter',
          cognitiveLevel: normaliseCogLevel(s.cognitiveLevel) || 'Applying',
          points: s.points || 1,
          questionType: s.questionType || 'multiple-choice',
        }));

      if (validSpecs.length > 0) {
        const cognitiveBreakdown: Record<string, number> = {};
        const topicBreakdown: Record<string, number> = {};

        validSpecs.forEach((s) => {
          topicBreakdown[s.topic] = (topicBreakdown[s.topic] || 0) + 1;
          cognitiveBreakdown[s.cognitiveLevel] = (cognitiveBreakdown[s.cognitiveLevel] || 0) + 1;
        });

        const cleanTopics = (aiParsed.topics || Object.keys(topicBreakdown)).filter((t) => !isAdministrativeMetadata(t));

        return {
          rawText,
          fileName: file.name,
          courseTitle: aiParsed.courseTitle,
          topics: cleanTopics,
          rows: [],
          itemSpecs: validSpecs,
          totalItems: validSpecs.length,
          totalPoints: aiParsed.totalPoints || validSpecs.reduce((sum, s) => sum + s.points, 0),
          cognitiveBreakdown,
          cognitiveLevels: cognitiveBreakdown,
          questionTypeBreakdown: {},
          topicBreakdown,
          parsedSuccessfully: true,
        };
      }
    }
  }

  // 2. Fallback to enhanced local table parser
  const filteredRows = rows.filter((r) => !isAdministrativeMetadata(r.topic));
  const itemSpecs = buildItemSpecs(filteredRows);
  let totalItems = itemSpecs.length > 0 ? itemSpecs.length : filteredRows.reduce((sum, r) => sum + r.itemCount, 0);

  let totalPoints = 0;
  const cognitiveBreakdown: Record<string, number> = {};
  const questionTypeBreakdown: Record<string, number> = {};
  const topicBreakdown: Record<string, number> = {};

  for (const spec of itemSpecs) {
    totalPoints += spec.points;
    cognitiveBreakdown[spec.cognitiveLevel] = (cognitiveBreakdown[spec.cognitiveLevel] || 0) + 1;
    topicBreakdown[spec.topic] = (topicBreakdown[spec.topic] || 0) + 1;
    if (spec.questionType) {
      questionTypeBreakdown[spec.questionType] = (questionTypeBreakdown[spec.questionType] || 0) + 1;
    }
  }

  // 3. Fallback: Parse document topics directly from text if matrix table yielded 0 items
  if (totalItems === 0 && rawText && rawText.trim().length > 30) {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const candidateTopics: string[] = [];
    let detectedCourse = '';
    let detectedTotal = 50;

    for (const line of lines) {
      if (isAdministrativeMetadata(line)) continue;
      const lc = line.toLowerCase();
      if (!detectedCourse && (lc.includes('course:') || lc.includes('subject:') || lc.includes('course title:'))) {
        const after = line.split(/[:=-]/)[1]?.trim();
        if (after && after.length > 3 && !isAdministrativeMetadata(after)) detectedCourse = after;
      }
      const totalMatch = line.match(/(?:total\s*(?:no\.?\s*of\s*)?items?|total\s*questions?|total\s*points?)\s*[:=-]?\s*(\d+)/i);
      if (totalMatch) {
        const val = parseInt(totalMatch[1], 10);
        if (!isNaN(val) && val >= 10 && val <= 100) detectedTotal = val;
      }

      const topicMatch = line.match(/^(?:(?:unit|module|chapter|topic|lesson|part)\s*[0-9ivx]+[:.-]?\s*|[0-9]{1,2}[.)]\s+|[ivx]+[.)]\s+)(.+)/i);
      if (topicMatch) {
        const t = topicMatch[1].replace(/[-–—]\s*\d+\s*(?:hrs?|hours?|%|pts?).*/i, '').trim();
        if (t.length > 3 && t.length < 90 && !isAdministrativeMetadata(t) && !candidateTopics.includes(t)) {
          candidateTopics.push(t);
        }
      } else if (line.length >= 6 && line.length <= 70 && !line.includes('|') && !line.includes('\t') && !/^\d+$/.test(line) && !isAdministrativeMetadata(line)) {
        if (!candidateTopics.includes(line) && candidateTopics.length < 10) {
          candidateTopics.push(line);
        }
      }
    }

    const finalTopics = candidateTopics.length > 0 ? candidateTopics : ['Core Subject Principles', 'Practical System Implementation', 'Analysis and Evaluation'];
    const synthSpecs: TOSItemSpec[] = [];

    for (let i = 1; i <= detectedTotal; i++) {
      const top = finalTopics[(i - 1) % finalTopics.length];
      const cog = i <= detectedTotal * 0.3
        ? 'Remembering'
        : i <= detectedTotal * 0.55
        ? 'Understanding'
        : i <= detectedTotal * 0.8
        ? 'Applying'
        : i <= detectedTotal * 0.92
        ? 'Analyzing'
        : 'Evaluating';

      synthSpecs.push({
        itemNumber: i,
        topic: top,
        cognitiveLevel: cog,
        points: 1,
        questionType: 'multiple-choice',
      });
      cognitiveBreakdown[cog] = (cognitiveBreakdown[cog] || 0) + 1;
      topicBreakdown[top] = (topicBreakdown[top] || 0) + 1;
    }

    return {
      rawText,
      fileName: file.name,
      courseTitle: detectedCourse || undefined,
      topics: Object.keys(topicBreakdown),
      rows: [],
      itemSpecs: synthSpecs,
      totalItems: detectedTotal,
      totalPoints: detectedTotal,
      cognitiveBreakdown,
      cognitiveLevels: cognitiveBreakdown,
      questionTypeBreakdown: { 'multiple-choice': detectedTotal },
      topicBreakdown,
      parsedSuccessfully: true,
    };
  }

  return {
    rawText,
    fileName: file.name,
    topics: Object.keys(topicBreakdown),
    rows: filteredRows,
    itemSpecs,
    totalItems,
    totalPoints: totalPoints || totalItems,
    cognitiveBreakdown,
    cognitiveLevels: cognitiveBreakdown,
    questionTypeBreakdown,
    topicBreakdown,
    parsedSuccessfully: totalItems > 0,
  };
}

/**
 * Builds the strict, authoritative instruction block that enforces
 * Cognitive Levels, Item Placement, and Topics per item for AI models.
 */
export function buildTOSConstraintText(tosData: TOSData): string {
  const lines: string[] = [];
  lines.push('================================================================================');
  lines.push('=== [MANDATORY STEP 1: TOS ANALYSIS & INVENTORY] ===');
  lines.push('================================================================================');
  lines.push('CRITICAL DIRECTIVE: An official Table of Specifications (TOS) governs this examination.');
  lines.push('VERIFICATION REQUIRED BEFORE GENERATING QUESTIONS:');
  lines.push('1. Review the attached TOS thoroughly.');
  lines.push('2. ANTI-HALLUCINATION: NEVER generate questions asking about administrative document metadata (such as "Effectivity Date", "March 01, 2024", "Revision No", "Prepared by", "Form No", or college signatures).');
  if (tosData.courseTitle) {
    lines.push(`3. Target Academic Course: "${tosData.courseTitle}"`);
  }
  lines.push(`4. Total questions to generate: ${tosData.totalItems} questions.`);
  lines.push(`5. Total points: ${tosData.totalPoints} points.`);
  lines.push('');

  if (tosData.cognitiveBreakdown && Object.keys(tosData.cognitiveBreakdown).length > 0) {
    lines.push('--- COGNITIVE LEVEL BREAKDOWN (MUST MATCH EXACTLY) ---');
    for (const [lvl, cnt] of Object.entries(tosData.cognitiveBreakdown)) {
      lines.push(`- ${lvl}: ${cnt} items`);
    }
    lines.push('');
  }

  if (tosData.topics && tosData.topics.length > 0) {
    lines.push('--- ACADEMIC TOPICS COVERED IN TOS ---');
    tosData.topics.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push('');
  }

  if (tosData.itemSpecs && tosData.itemSpecs.length > 0) {
    lines.push('--- ITEM-BY-ITEM SPECIFICATION MATRIX (EXACT BLUEPRINT) ---');
    lines.push('Generate a question for EACH item number below matching its Topic and Cognitive Level:');
    for (const spec of tosData.itemSpecs) {
      lines.push(`Item #${spec.itemNumber} | Placement: ${spec.itemNumber} | Cognitive: ${spec.cognitiveLevel} | Topic: "${spec.topic}" | Points: ${spec.points}${spec.questionType ? ` | Type: ${spec.questionType}` : ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * Enhanced file extraction across multiple files.
 */
export async function extractFilesContentEnhanced(
  files: File[],
  tosFile: File | null,
  apiKey?: string,
  syllabusFile?: File | null
): Promise<{ text: string; tosData?: TOSData; unreadable: string[] }> {
  const validFiles = files.filter(Boolean);
  if (validFiles.length === 0) return { text: '', unreadable: [] };
  // Files that gave no text (scanned PDFs, old .ppt), so the user can be told.
  const unreadable: string[] = [];

  let extractedAll = '';
  let parsedTos: TOSData | undefined = undefined;

  for (const file of validFiles) {
    const isTos = tosFile && (file === tosFile || file.name === tosFile.name);
    try {
      if (isTos) {
        parsedTos = await parseTOSFile(file, apiKey);
        extractedAll += `\n\n=== ATTACHED TABLE OF SPECIFICATIONS (${file.name}) ===\n${parsedTos.rawText || ''}\n`;
      } else {
        const text = await extractFileText(file);
        if (text) {
          const isSyllabus = syllabusFile && (file === syllabusFile || file.name === syllabusFile.name);
          extractedAll += `\n\n=== ${isSyllabus ? 'COURSE SYLLABUS' : 'ATTACHED MATERIAL'}: ${file.name} ===\n${text}\n`;
        } else {
          unreadable.push(file.name);
        }
      }
    } catch (err) {
      console.warn(`[TOSParser] Failed to extract ${file.name}:`, err);
      unreadable.push(file.name);
    }
  }

  return { text: extractedAll.trim(), tosData: parsedTos, unreadable };
}
