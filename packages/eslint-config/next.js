// @oneid/eslint-config — Next.js config
import base from "./index.js";

/** @type {import("eslint").Linter.FlatConfig[]} */
const nextConfig = [
  ...base,
  // @next/eslint-plugin-next is a peer dep — consumers add it themselves via next lint.
  // We keep this file as a re-export of base so the next.js preset is available
  // without importing the plugin directly (avoids resolution issues in non-Next packages).
];

export default nextConfig;
