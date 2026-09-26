/**
 * Renders JSON-LD structured data.
 *
 * The payload has to go in through dangerouslySetInnerHTML -- React escapes text
 * children as HTML entities, which a JSON-LD parser will not decode -- so the
 * escaping has to happen here instead.
 *
 * This used to be commented "safe: data is our own". That stopped being true
 * when the projects CMS landed: case-study prose is now typed in the admin and
 * flows into articleJsonLd, so `data` carries user input. JSON.stringify does
 * NOT escape `<` or `/`, so a description containing `</script>` would close the
 * tag early and anything after it would execute on the live public site.
 *
 * Escaping `<` and `>` makes `</script>` unrepresentable; `&` closes off entity
 * tricks; U+2028 and U+2029 are line terminators in JavaScript but legal raw
 * inside a JSON string, which breaks parsing in a script context. All five are
 * valid JSON string escapes, so the structured data itself is unchanged --
 * Google sees exactly the same object.
 *
 * Written with character codes rather than a regex on purpose: putting literal
 * U+2028/U+2029 in this file would break the parser reading THIS file, which is
 * the same trick being defended against one level down.
 */
const ESCAPED: Record<number, string> = {
  0x3c: "\\u003c", // <
  0x3e: "\\u003e", // >
  0x26: "\\u0026", // &
  0x2028: "\\u2028", // line separator
  0x2029: "\\u2029", // paragraph separator
};

function escapeForScript(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    out += ESCAPED[input.charCodeAt(i)] || input[i];
  }
  return out;
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = escapeForScript(JSON.stringify(data));
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}