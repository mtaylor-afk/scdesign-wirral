// Image pipeline: sniffing, lossless metadata stripping, orientation, limits, masks. (A2)
import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { load, require } from "./helpers.mjs";

const images = load("serverlib/wvroofing/images.js");
const { crc32 } = load("serverlib/wvroofing/core.js");
const sharp = images.sharp(); // the locked-down instance (JPEG/PNG loaders only)

/** An asymmetric test picture, so any wrong rotation or flip changes the pixels. */
function asymRaw(w, h) {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const red = x < w / 3;
      const green = !red && y < h / 2;
      raw[i] = red ? 220 : (x * 7) & 255;
      raw[i + 1] = green ? 200 : (y * 5) & 255;
      raw[i + 2] = !red && !green ? 210 : ((x + y) * 3) & 255;
    }
  return raw;
}

async function baseJpeg(w = 720, h = 480) {
  return sharp(asymRaw(w, h), { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

function seg(marker, payload) {
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), len, payload]);
}

/** EXIF APP1 with an orientation and a "secret" ImageDescription standing in for GPS data. */
function exifApp1(orientation, secret) {
  const text = Buffer.from(secret + "\u0000", "ascii");
  const tiff = Buffer.alloc(38 + text.length);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(2, 8);
  tiff.writeUInt16LE(0x010e, 10); // ImageDescription
  tiff.writeUInt16LE(2, 12);
  tiff.writeUInt32LE(text.length, 14);
  tiff.writeUInt32LE(38, 18);
  tiff.writeUInt16LE(0x0112, 22); // Orientation
  tiff.writeUInt16LE(3, 24);
  tiff.writeUInt32LE(1, 26);
  tiff.writeUInt16LE(orientation, 30);
  tiff.writeUInt32LE(0, 34);
  text.copy(tiff, 38);
  return seg(0xe1, Buffer.concat([Buffer.from("Exif\u0000\u0000", "ascii"), tiff]));
}

/** Insert segments after SOI and any APP0 (JFIF), where EXIF normally sits. */
function insertAfterApp0(jpeg, segments) {
  let at = 2;
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) at = 4 + jpeg.readUInt16BE(4);
  return Buffer.concat([jpeg.subarray(0, at), ...segments, jpeg.subarray(at)]);
}

async function rawOf(buf) {
  return sharp(buf).rotate().raw().toBuffer({ resolveWithObject: true });
}

test("sniff recognises formats by their bytes, not their names", async () => {
  assert.equal(images.sniff(await baseJpeg(32, 32)), "jpeg");
  assert.equal(images.sniff(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer()), "png");
  const heic = Buffer.alloc(40);
  heic.writeUInt32BE(24, 0);
  heic.write("ftypheic", 4, "ascii");
  assert.equal(images.sniff(heic), "heic");
  assert.equal(images.sniff(Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ", "latin1")), "webp");
  assert.equal(images.sniff(Buffer.from("GIF89a....", "ascii")), "gif");
  assert.equal(images.sniff(Buffer.from("<svg xmlns=", "ascii")), null);
});

test("JPEG: EXIF/GPS, XMP, IPTC, comments and trailing data are removed; pixels are untouched", async () => {
  const base = await baseJpeg();
  const xmp = seg(0xe1, Buffer.from("http://ns.adobe.com/xap/1.0/\u0000<x:xmpmeta>SECRET-XMP</x:xmpmeta>", "latin1"));
  const iptc = seg(0xed, Buffer.from("Photoshop 3.0\u0000SECRET-IPTC", "latin1"));
  const com = seg(0xfe, Buffer.from("SECRET-COMMENT", "latin1"));
  const original = Buffer.concat([insertAfterApp0(base, [exifApp1(6, "SECRET-GPS-53.40N"), xmp, iptc, com]), Buffer.from("SECRET-TRAILER", "latin1")]);
  const { data, orientation } = images.stripJpeg(original);
  assert.equal(orientation, 6);
  assert.ok(!data.includes("SECRET"), "no metadata may survive");
  assert.equal(images.sniff(data), "jpeg");
  const a = await rawOf(original);
  const b = await rawOf(data);
  assert.deepEqual([b.info.width, b.info.height], [480, 720], "orientation 6 still shows upright");
  assert.ok(a.data.equals(b.data), "decoded pixels identical");
});

test("all eight EXIF orientations produce the same upright picture as the untouched file", async () => {
  const base = await baseJpeg();
  for (let o = 1; o <= 8; o++) {
    const original = await sharp(base).withMetadata({ orientation: o }).jpeg({ quality: 90 }).toBuffer();
    const out = await images.processUpload(original);
    assert.equal(out.orientation, o, "orientation " + o);
    const ref = await rawOf(original);
    const mine = await rawOf(out.original);
    assert.ok(ref.data.equals(mine.data), "stored original decodes identically, orientation " + o);
    const work = await sharp(out.working).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([out.workW, out.workH], [ref.info.width, ref.info.height], "working copy upright, orientation " + o);
    assert.ok(work.data.equals(ref.data), "working copy is the lossless upright picture, orientation " + o);
  }
});

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

test("PNG: text, eXIf, time and trailing data are removed; orientation is kept", async () => {
  const png = await sharp(asymRaw(600, 500), { raw: { width: 600, height: 500, channels: 3 } }).png().toBuffer();
  const ihdrEnd = 8 + 25;
  const tiff = images.minimalExifTiff(3);
  const withMeta = Buffer.concat([
    png.subarray(0, ihdrEnd),
    chunk("tEXt", Buffer.from("Comment\u0000SECRET-PNG-TEXT", "latin1")),
    chunk("eXIf", tiff),
    chunk("tIME", Buffer.from([7, 234, 9, 28, 10, 0, 0])),
    png.subarray(ihdrEnd),
    Buffer.from("SECRET-TRAIL", "latin1"),
  ]);
  const { data, orientation } = images.stripPng(withMeta);
  assert.equal(orientation, 3);
  assert.ok(!data.includes("SECRET"));
  assert.ok(!data.includes("tIME"));
  const a = await rawOf(withMeta);
  const b = await rawOf(data);
  assert.ok(a.data.equals(b.data), "decoded pixels identical");
});

test("uploads that are refused, and why", async () => {
  const heic = Buffer.alloc(64);
  heic.writeUInt32BE(24, 0);
  heic.write("ftypheic", 4, "ascii");
  await assert.rejects(images.processUpload(heic), (e) => e.code === "invalid_image" && /HEIC/.test(e.message));
  await assert.rejects(images.processUpload(Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPVP8 xxxxxxxx", "latin1")), (e) => e.code === "invalid_image" && /JPG or PNG/.test(e.message));
  await assert.rejects(images.processUpload(await baseJpeg(400, 300)), (e) => e.code === "invalid_image" && /too small/.test(e.message));
  const whole = await baseJpeg();
  await assert.rejects(images.processUpload(whole.subarray(0, Math.floor(whole.length * 0.6))), (e) => e.code === "invalid_image");
});

test("a small file claiming huge dimensions is refused from its header, without decoding", async () => {
  const jpg = Buffer.from(await baseJpeg());
  let i = 2;
  while (!(jpg[i] === 0xff && jpg[i + 1] === 0xc0)) i++;
  jpg.writeUInt16BE(20000, i + 5); // height
  jpg.writeUInt16BE(20000, i + 7); // width
  const t0 = Date.now();
  await assert.rejects(images.processUpload(jpg), (e) => e.code === "invalid_image" && /too large in pixels/.test(e.message));
  assert.ok(Date.now() - t0 < 500, "no decoding attempted");
});

function maskPng(w, h, isRoof, ctype = 6) {
  const bpp = ctype === 6 ? 4 : 2;
  const raw = Buffer.alloc(h * (w * bpp + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * bpp + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * bpp + 1) + 1 + x * bpp;
      raw[o + bpp - 1] = isRoof(x, y) ? 0 : 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = ctype;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

test("roof outline: coverage measured; wrong size or a decompression bomb refused", () => {
  const good = maskPng(100, 50, (x) => x < 20);
  assert.equal(images.maskInfo(good, 100, 50).transparentFrac, 0.2);
  assert.equal(images.maskInfo(maskPng(100, 50, (x) => x < 50, 4), 100, 50).transparentFrac, 0.5, "grey+alpha works too");
  assert.throws(() => images.maskInfo(good, 101, 50), (e) => e.code === "invalid_mask" && /doesn't match/.test(e.message));
  // header says 64x48, but the data inflates to far more than a 64x48 mask needs
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(64, 0);
  ihdr.writeUInt32BE(48, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const bomb = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.alloc(8 * 1024 * 1024))), chunk("IEND", Buffer.alloc(0))]);
  assert.throws(() => images.maskInfo(bomb, 64, 48), (e) => e.code === "invalid_mask");
  const rgb = Buffer.from(maskPng(10, 10, () => false));
  rgb[25] = 2; // colour type RGB, no alpha
  assert.throws(() => images.maskInfo(rgb, 10, 10), (e) => e.code === "invalid_mask");
});

test("outline shapes are validated and rounded", () => {
  const out = images.cleanShapes([{ mode: "add", pts: [[1.4, 2.6], [50, 2], [50, 40]] }, { mode: "sub", pts: [[10, 10]], r: 6.4 }], 100, 50);
  assert.deepEqual(out, [{ mode: "add", pts: [[1, 3], [50, 2], [50, 40]] }, { mode: "sub", pts: [[10, 10]], r: 6 }]);
  assert.throws(() => images.cleanShapes([{ mode: "add", pts: [[500, 2]] }], 100, 50));
  assert.throws(() => images.cleanShapes([{ mode: "zap", pts: [[5, 2]] }], 100, 50));
  assert.throws(() => images.cleanShapes([], 100, 50));
});

test("display JPEG has the working copy's exact size", async () => {
  const out = await images.processUpload(await baseJpeg(2400, 1600));
  assert.deepEqual([out.workW, out.workH], [1600, 1067]);
  const meta = await sharp(await images.displayJpeg(out.working)).metadata();
  assert.deepEqual([meta.width, meta.height, meta.format], [1600, 1067, "jpeg"]);
});

test("only JPEG and PNG can be decoded by sharp in this process", async () => {
  const gif = Buffer.from("47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b", "hex");
  await assert.rejects(sharp(gif).metadata());
  void require; // keep the helper import used
});
