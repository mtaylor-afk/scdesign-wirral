/**
 * SC Design Wirral — admin logout. Clears the session cookie.
 */

const { applyCors, clearCookie } = require("../serverlib/common");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  res.setHeader("Set-Cookie", clearCookie());
  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true }));
};
