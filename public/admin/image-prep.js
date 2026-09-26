/**
 * SC Design Wirral — admin: prepare a photograph in the browser before upload.
 *
 * Plain script, no modules (admin.js is a deferred <script> global, same as
 * error-capture.js). Exposes window.SCImagePrep.
 *
 * WHY THIS RUNS IN THE BROWSER rather than on the server:
 *
 *  1. PRIVACY. Re-encoding through a canvas discards every metadata block,
 *     including the GPS tags a phone writes into a photo of someone's house.
 *     Those coordinates never leave the machine. Uploading the original and
 *     stripping it server-side would mean the exact location of a customer's
 *     home had already crossed the wire and been written to storage.
 *  2. IT FITS THROUGH THE DOOR. A modern phone photo is 3–12 MB, and the
 *     serverless function that receives it has a request-body limit well under
 *     that. Resizing first turns a 12 MB upload into roughly 300 KB.
 *  3. REDACTION NEEDS A PICTURE. Sean has to see the photo to drag a box over a
 *     house number, so the pixels are already here. Doing it now means the
 *     unredacted version is never uploaded at all — the redaction is not a
 *     setting that something later has to honour.
 *  4. No sharp dependency inside the Vercel function.
 *
 * The server still re-checks what arrives (magic bytes, byte cap) and the build
 * measures the committed file itself — this is a convenience, never the only
 * line of defence.
 */
(function () {
  "use strict";

  /** Matches MAX in scripts/process-brief-images.mjs, so both paths agree. */
  var MAX_EDGE = 1600;
  /** Matches MAX_IMAGE_BYTES in serverlib/cms.js. */
  var MAX_BYTES = 1200000;
  var QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5];

  function isSupportedType(file) {
    return /^image\/(jpeg|png|webp)$/i.test(file && file.type ? file.type : "");
  }

  /**
   * Decode a file to something drawable.
   *
   * createImageBitmap with imageOrientation:"from-image" applies the EXIF
   * orientation tag, which is what stops a portrait phone photo arriving on its
   * side — the sharp pipeline solves the same problem with .rotate(). Safari
   * only gained that option relatively recently, so fall back to an <img>,
   * which browsers orient automatically.
   */
  function decode(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () {
          return decodeViaImg(file);
        });
      } catch (err) {
        return decodeViaImg(file);
      }
    }
    return decodeViaImg(file);
  }

  function decodeViaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        // Overwhelmingly this is an iPhone HEIC/HEIF file, which Windows
        // browsers cannot decode. Say so in words Sean can act on.
        reject(
          new Error(
            "This image could not be read. If it came straight from an iPhone it may be a HEIC file — " +
              'set the camera to "Most Compatible", or share the photo so it converts to JPEG, then try again.'
          )
        );
      };
      img.src = url;
    });
  }

  function sizeOf(src) {
    return {
      w: src.naturalWidth || src.width,
      h: src.naturalHeight || src.height,
    };
  }

  /** Longest edge down to MAX_EDGE, never scaled up. */
  function fit(w, h, maxEdge) {
    var scale = Math.min(1, maxEdge / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
  }

  function canvasOf(w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function toBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(
        function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("The browser could not encode this image."));
        },
        type,
        quality
      );
    });
  }

  /**
   * Destroy detail inside a region: downscale hard, then scale back up.
   *
   * Deliberately not a Gaussian blur. A blur convolves the pixels and, given the
   * kernel, can be partially inverted — which is no good when the thing being
   * hidden is a house number on a real person's home. Averaging 14x14 blocks
   * down to single pixels throws the information away instead, and it works in
   * every browser rather than depending on ctx.filter support.
   *
   * Boxes are normalised (0..1) so they stay correct whatever size the preview
   * was displayed at and survive the resize to 1600px.
   */
  function redactRegion(ctx, source, box, srcW, srcH, outW, outH) {
    var sx = Math.max(0, Math.floor(box.x * srcW));
    var sy = Math.max(0, Math.floor(box.y * srcH));
    var sw = Math.min(srcW - sx, Math.ceil(box.w * srcW));
    var sh = Math.min(srcH - sy, Math.ceil(box.h * srcH));
    if (sw < 2 || sh < 2) return;

    var dx = Math.floor(box.x * outW);
    var dy = Math.floor(box.y * outH);
    var dw = Math.ceil(box.w * outW);
    var dh = Math.ceil(box.h * outH);

    if (box.mode === "solid") {
      // The white-out used for "WORK IN PROGRESS" stamps on drawings, matching
      // the `fill` boxes in the sharp pipeline.
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(dx, dy, dw, dh);
      ctx.restore();
      return;
    }

    // Resolve the region to at most MAX_BLOCKS cells on its longer edge.
    //
    // This is a fixed GRID, not a fixed block size. An earlier version divided by
    // a constant 14px, which left a 14x11 grid on a typical house-number box —
    // and a two-digit number was still plainly readable afterwards. Tying the
    // grid to the region instead means a house number resolves to about two
    // cells per digit whatever size the box is drawn, which no amount of
    // squinting recovers.
    var MAX_BLOCKS = 4;
    var step = Math.max(dw, dh) / MAX_BLOCKS;
    var tiny = canvasOf(
      Math.max(1, Math.round(dw / step)),
      Math.max(1, Math.round(dh / step))
    );
    var tctx = tiny.getContext("2d");
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(source, sx, sy, sw, sh, 0, 0, tiny.width, tiny.height);

    ctx.save();
    // Nearest-neighbour on the way back up: smoothing would interpolate the
    // cells into a soft gradient, which reads as "blurred" and invites someone
    // to try to sharpen it. Hard blocks make it obvious the detail is gone.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, dx, dy, dw, dh);
    ctx.restore();
  }

  /**
   * Prepare one file for upload.
   *
   * @param {File} file
   * @param {{redactions?: Array<{x:number,y:number,w:number,h:number,mode?:string}>,
   *          maxEdge?:number, maxBytes?:number, png?:boolean}} [opts]
   * @returns {Promise<{blob:Blob, dataUrl:string, width:number, height:number,
   *                    bytes:number, ext:string, originalWidth:number,
   *                    originalHeight:number, quality:number, redactions:number}>}
   */
  function prepare(file, opts) {
    opts = opts || {};
    if (!file) return Promise.reject(new Error("No file was given."));
    if (!isSupportedType(file)) {
      return Promise.reject(
        new Error(
          "Please use a JPEG or PNG. " +
            (file.type ? 'This file is "' + file.type + '".' : "This file has no recognised type.")
        )
      );
    }

    var maxEdge = opts.maxEdge || MAX_EDGE;
    var maxBytes = opts.maxBytes || MAX_BYTES;
    var redactions = (opts.redactions || []).filter(function (b) {
      return b && b.w > 0 && b.h > 0;
    });

    // Drawings keep sharp lines and flat colour, so PNG suits them; photographs
    // go to JPEG. Same split as the sharp pipeline.
    var wantPng = !!opts.png;

    return decode(file).then(function (source) {
      var src = sizeOf(source);
      if (!src.w || !src.h) throw new Error("This image has no readable dimensions.");
      var out = fit(src.w, src.h, maxEdge);

      var canvas = canvasOf(out.w, out.h);
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser would not provide a canvas to resize the image.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // Flatten onto white: a transparent PNG saved as JPEG would otherwise go black.
      if (!wantPng) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, out.w, out.h);
      }
      ctx.drawImage(source, 0, 0, src.w, src.h, 0, 0, out.w, out.h);

      for (var i = 0; i < redactions.length; i++) {
        redactRegion(ctx, source, redactions[i], src.w, src.h, out.w, out.h);
      }

      if (source.close) {
        try {
          source.close();
        } catch (err) {
          /* an ImageBitmap we no longer need; nothing to do if it refuses */
        }
      }

      if (wantPng) {
        return toBlob(canvas, "image/png").then(function (blob) {
          if (blob.size > maxBytes) {
            // A PNG cannot be quality-stepped, so fall back to JPEG rather than
            // refuse the upload outright.
            return encodeJpeg(canvas, maxBytes).then(function (r) {
              return finish(canvas, r.blob, r.quality, "jpg", src, out, redactions.length);
            });
          }
          return finish(canvas, blob, 1, "png", src, out, redactions.length);
        });
      }

      return encodeJpeg(canvas, maxBytes).then(function (r) {
        return finish(canvas, r.blob, r.quality, "jpg", src, out, redactions.length);
      });
    });
  }

  /** Step the quality down until it fits the cap. */
  function encodeJpeg(canvas, maxBytes) {
    var i = 0;
    function attempt() {
      return toBlob(canvas, "image/jpeg", QUALITY_STEPS[i]).then(function (blob) {
        if (blob.size <= maxBytes || i === QUALITY_STEPS.length - 1) {
          return { blob: blob, quality: QUALITY_STEPS[i] };
        }
        i++;
        return attempt();
      });
    }
    return attempt();
  }

  function finish(canvas, blob, quality, ext, src, out, redactionCount) {
    return blobToDataUrl(blob).then(function (dataUrl) {
      return {
        blob: blob,
        dataUrl: dataUrl,
        width: out.w,
        height: out.h,
        bytes: blob.size,
        ext: ext,
        quality: quality,
        originalWidth: src.w,
        originalHeight: src.h,
        redactions: redactionCount,
      };
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        resolve(String(fr.result));
      };
      fr.onerror = function () {
        reject(new Error("The browser could not read the encoded image back."));
      };
      fr.readAsDataURL(blob);
    });
  }

  /** Just the base64 payload, for a JSON POST body. */
  function base64Of(dataUrl) {
    var comma = dataUrl.indexOf(",");
    return comma === -1 ? "" : dataUrl.slice(comma + 1);
  }

  /** A small preview for the editor list, so thumbnails are not full-size. */
  function thumbnail(dataUrl, edge) {
    edge = edge || 240;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var out = fit(img.naturalWidth, img.naturalHeight, edge);
        var c = canvasOf(out.w, out.h);
        var ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, out.w, out.h);
        resolve(c.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = function () {
        reject(new Error("Could not build a preview for this image."));
      };
      img.src = dataUrl;
    });
  }

  /** Suggest a safe filename that satisfies the schema in serverlib/cms.js. */
  function safeName(label, ext, taken) {
    var base = String(label || "photo")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    if (!/^[a-z0-9]/.test(base)) base = "photo" + (base ? "-" + base : "");
    if (!base) base = "photo";
    var name = base + "." + ext;
    var n = 2;
    while (taken && taken.indexOf(name) !== -1) {
      name = base + "-" + n + "." + ext;
      n++;
    }
    return name;
  }

  window.SCImagePrep = {
    prepare: prepare,
    thumbnail: thumbnail,
    base64Of: base64Of,
    safeName: safeName,
    isSupportedType: isSupportedType,
    MAX_EDGE: MAX_EDGE,
    MAX_BYTES: MAX_BYTES,
  };
})();
