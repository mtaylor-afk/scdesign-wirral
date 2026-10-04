'use strict';

// A small, deterministic ZIP writer for the build pack (FORMS-CONTRACT section 6). STORE only (method 0), CRC-32,
// UTF-8 names (general purpose bit 11), DOS timestamps from the given date (UTC), no extra fields, no comments, no
// encryption, no ZIP64. Paths are checked: relative, forward slashes only, no '.'/'..' segments, no backslashes, no
// empty segments, a conservative character set, no duplicates. The total size is bounded (the pack holds only
// generated text). Same entries + same date = same bytes.

const MAX_ZIP_BYTES = 2 * 1024 * 1024;
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const UTF8_FLAG = 0x0800;
const VERSION = 20;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function checkPath(name, directory) {
  if (typeof name !== 'string' || name === '' || name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    throw new Error(`mtcw zip: unsafe path "${name}"`);
  }
  if (directory !== name.endsWith('/')) throw new Error(`mtcw zip: directory entries end with "/" ("${name}")`);
  const segments = (directory ? name.slice(0, -1) : name).split('/');
  for (const segment of segments) {
    if (!SAFE_SEGMENT.test(segment) || segment === '.' || segment === '..') {
      throw new Error(`mtcw zip: unsafe path segment in "${name}"`);
    }
  }
}

function dosDateTime(date) {
  const year = Math.min(Math.max(date.getUTCFullYear(), 1980), 2107);
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { time, day };
}

/**
 * Build a ZIP. `entries` = [{ name, data: Buffer|string }] or [{ name: 'folder/', directory: true }], in order.
 * Returns a Buffer.
 */
function createZip(entries, date) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 1000) throw new Error('mtcw zip: bad entry list');
  const { time, day } = dosDateTime(date);
  const seen = new Set();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const directory = entry.directory === true;
    checkPath(entry.name, directory);
    if (seen.has(entry.name)) throw new Error(`mtcw zip: duplicate entry "${entry.name}"`);
    seen.add(entry.name);
    const name = Buffer.from(entry.name, 'utf8');
    const data = directory ? Buffer.alloc(0) : Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const crc = directory ? 0 : crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(0, 8); // STORE
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // no extra field
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION, 4); // made by: MS-DOS / FAT, 2.0
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE(directory ? 0x10 : 0, 38); // external attributes (MS-DOS directory bit)
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
    if (offset > MAX_ZIP_BYTES) throw new Error('mtcw zip: too large');
  }

  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  const zip = Buffer.concat([...locals, ...centrals, end]);
  if (zip.length > MAX_ZIP_BYTES) throw new Error('mtcw zip: too large');
  return zip;
}

module.exports = { createZip, crc32, MAX_ZIP_BYTES };
