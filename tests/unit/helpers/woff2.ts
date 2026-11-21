/**
 * A minimal WOFF2 reader for tests (Story 8.1): just enough to check what a
 * shipped font covers and how wide its glyphs are. It decompresses the one
 * Brotli stream (node:zlib) and reads the untransformed `cmap`, `hhea`,
 * `OS/2` and `hmtx` tables (a transformed `hmtx` is read too). Spec:
 * https://www.w3.org/TR/WOFF2/
 */
import { brotliDecompressSync } from 'node:zlib';

/** The WOFF2 known-table tags, by flag index (WOFF2 §5.1). */
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
  'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
  'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
  'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
] as const;

interface Table {
  data: Buffer;
  transformed: boolean;
}

export interface Woff2Font {
  /** OS/2 usWeightClass (400 regular, 700 bold). */
  weight: number;
  /** The advance width of the glyph a code point maps to, or undefined when the font lacks it. */
  advance(codePoint: number): number | undefined;
}

function readBase128(buf: Buffer, at: { pos: number }): number {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[at.pos++];
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error('woff2: bad UIntBase128');
}

function readTables(file: Buffer): Map<string, Table> {
  if (file.toString('latin1', 0, 4) !== 'wOF2') throw new Error('woff2: not a WOFF2 file');
  const numTables = file.readUInt16BE(12);
  const compressedSize = file.readUInt32BE(20);
  const at = { pos: 48 };
  const entries: { tag: string; length: number; transformed: boolean }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = file[at.pos++];
    const index = flags & 0x3f;
    let tag: string;
    if (index === 63) {
      tag = file.toString('latin1', at.pos, at.pos + 4);
      at.pos += 4;
    } else {
      tag = KNOWN_TAGS[index];
    }
    const version = (flags >> 6) & 0x03;
    const origLength = readBase128(file, at);
    // glyf/loca: version 0 is the transform, 3 the null transform. Others: 0 is null.
    const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
    const length = transformed ? readBase128(file, at) : origLength;
    entries.push({ tag, length, transformed });
  }
  const stream = brotliDecompressSync(file.subarray(at.pos, at.pos + compressedSize));
  const tables = new Map<string, Table>();
  let offset = 0;
  for (const e of entries) {
    tables.set(e.tag, { data: stream.subarray(offset, offset + e.length), transformed: e.transformed });
    offset += e.length;
  }
  return tables;
}

/** Code point → glyph id, from the best Unicode subtable (format 12, else format 4). */
function readCmap(cmap: Buffer): Map<number, number> {
  const count = cmap.readUInt16BE(2);
  const subtables: { platform: number; encoding: number; offset: number }[] = [];
  for (let i = 0; i < count; i++) {
    const p = 4 + i * 8;
    subtables.push({ platform: cmap.readUInt16BE(p), encoding: cmap.readUInt16BE(p + 2), offset: cmap.readUInt32BE(p + 4) });
  }
  const unicode = subtables.filter((s) => s.platform === 0 || (s.platform === 3 && (s.encoding === 1 || s.encoding === 10)));
  const map = new Map<number, number>();
  const format12 = unicode.find((s) => cmap.readUInt16BE(s.offset) === 12);
  if (format12) {
    const o = format12.offset;
    const groups = cmap.readUInt32BE(o + 12);
    for (let g = 0; g < groups; g++) {
      const p = o + 16 + g * 12;
      const start = cmap.readUInt32BE(p);
      const end = cmap.readUInt32BE(p + 4);
      const gid = cmap.readUInt32BE(p + 8);
      for (let c = start; c <= end; c++) map.set(c, gid + (c - start));
    }
    return map;
  }
  const format4 = unicode.find((s) => cmap.readUInt16BE(s.offset) === 4);
  if (!format4) throw new Error('woff2: no Unicode cmap');
  const o = format4.offset;
  const segX2 = cmap.readUInt16BE(o + 6);
  const ends = o + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  for (let s = 0; s < segX2; s += 2) {
    const end = cmap.readUInt16BE(ends + s);
    const start = cmap.readUInt16BE(starts + s);
    const delta = cmap.readInt16BE(deltas + s);
    const rangeOffset = cmap.readUInt16BE(ranges + s);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let gid: number;
      if (rangeOffset === 0) gid = (c + delta) & 0xffff;
      else {
        const g = cmap.readUInt16BE(ranges + s + rangeOffset + (c - start) * 2);
        gid = g === 0 ? 0 : (g + delta) & 0xffff;
      }
      if (gid !== 0) map.set(c, gid);
    }
  }
  return map;
}

export function readWoff2(file: Buffer): Woff2Font {
  const tables = readTables(file);
  const need = (tag: string): Table => {
    const t = tables.get(tag);
    if (!t) throw new Error(`woff2: no ${tag} table`);
    return t;
  };
  const cmap = readCmap(need('cmap').data);
  const numberOfHMetrics = need('hhea').data.readUInt16BE(34);
  const hmtx = need('hmtx');
  // Untransformed: (advance, lsb) pairs. Transformed: a flags byte, then the advances.
  const advanceAt = (i: number) => (hmtx.transformed ? hmtx.data.readUInt16BE(1 + i * 2) : hmtx.data.readUInt16BE(i * 4));
  const advances = Array.from({ length: numberOfHMetrics }, (_, i) => advanceAt(i));
  return {
    weight: need('OS/2').data.readUInt16BE(4),
    advance(codePoint) {
      const gid = cmap.get(codePoint);
      if (gid === undefined) return undefined;
      return advances[Math.min(gid, numberOfHMetrics - 1)];
    },
  };
}
