import eslintConfig from "@oneid/eslint-config";

export default [
  {
    ignores: ["src/generated/**", "dist/**"],
  },
  ...eslintConfig,
];
