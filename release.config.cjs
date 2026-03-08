import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "release.config.cjs"] }, // ← ignore CJS
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,js}"],
    rules: {
      "no-console": "off", // ← allow console in seed
      "@typescript-eslint/no-explicit-any": "off", // ← allow any for now
      "no-undef": "off", // ← disable for CJS files
    },
  },
);
