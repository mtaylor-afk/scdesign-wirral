// The bridged legacy render endpoint needs the image_generation switch, not just a key. (A1)
import { test } from "node:test";
import assert from "node:assert/strict";
import { load, call } from "./helpers.mjs";

const app = load("api/wvroofing/app.js");

test("with a key but the switch off, renders are not live", async () => {
  process.env.WVR_OPENAI_API_KEY = "sk-test-not-real";
  delete process.env.WVR_CAP_IMAGE_GENERATION;
  try {
    const h = await call(app, "GET", "/api/wvroofing/render", {});
    assert.equal(h.json.live, false);
    const post = await call(app, "POST", "/api/wvroofing/render", { origin: "https://scdesignwirral.co.uk", "content-type": "application/json" }, { productId: "welsh-slate" });
    // validation happens first (bad payload), so this proves nothing about the key; the health flag is the check
    assert.ok([400, 503].includes(post.status));
  } finally {
    delete process.env.WVR_OPENAI_API_KEY;
  }
});

test("with the key and the switch on, health reports renders as live", async () => {
  process.env.WVR_OPENAI_API_KEY = "sk-test-not-real";
  process.env.WVR_CAP_IMAGE_GENERATION = "on";
  try {
    const h = await call(app, "GET", "/api/wvroofing/render", {});
    assert.equal(h.json.live, true);
  } finally {
    delete process.env.WVR_OPENAI_API_KEY;
    delete process.env.WVR_CAP_IMAGE_GENERATION;
  }
});

test("the kill switch still stops live renders", async () => {
  process.env.WVR_OPENAI_API_KEY = "sk-test-not-real";
  process.env.WVR_CAP_IMAGE_GENERATION = "on";
  process.env.WVR_ENABLED = "0";
  try {
    const h = await call(app, "GET", "/api/wvroofing/render", {});
    assert.equal(h.json.live, false);
  } finally {
    delete process.env.WVR_OPENAI_API_KEY;
    delete process.env.WVR_CAP_IMAGE_GENERATION;
    delete process.env.WVR_ENABLED;
  }
});
