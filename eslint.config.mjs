import next from "eslint-config-next";

/** Next.js 16 ships eslint-config-next as a native flat-config array. */
const eslintConfig = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**"],
  },
];

export default eslintConfig;
