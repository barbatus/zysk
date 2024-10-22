const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

module.exports = {
  extends: [
    require.resolve("@vercel/style-guide/eslint/node"),
    require.resolve("@vercel/style-guide/eslint/typescript"),
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "turbo",
  ],
  ignorePatterns: [".eslintrc.js", "next.config.mjs", "dist/"],
  plugins: [
    "simple-import-sort",
    "unused-imports",
  ],
  parserOptions: {
    project,
  },
  settings: {
    "import/resolver": {
      typescript: {
        project,
      },
    },
  },
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-non-null-assertion": "off",

    "react/react-in-jsx-scope": "off",

    'import/no-default-export': 'off',
    "import/export": "off", // See https://github.com/import-js/eslint-plugin-import/issues/2167
    "import/no-deprecated": "warn",
    "import/no-duplicates": "error",
    "import/no-named-as-default": "error",
    "import/no-named-as-default-member": "error",
    "import/no-unresolved": "off",
    "import/order": "off",
    "simple-import-sort/exports": "error",
    "simple-import-sort/imports": "error",
    "sort-imports": "off",

    "unused-imports/no-unused-imports": "error",

    // console.log rules
    "no-console": [
      "error",
      {
        allow: ["warn", "error"],
      },
    ],
  },
};
