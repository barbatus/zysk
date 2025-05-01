module.exports = {
  root: true,
  extends: ["@zysk/eslint-config/node-eslint.js"],
  ignorePatterns: ["/*", "!/src"],
  rules: {
    "eslint-comments/require-description": "off",
    "no-console": "warn",
    "@typescript-eslint/restrict-template-expressions": [
      "error",
      {
        allowNumber: true,
      },
    ],
    "max-len": [
      "error",
      {
        code: 100,
        ignoreTemplateLiterals: true,
        ignoreStrings: false,
        ignoreComments: true,
      },
    ],
    "template-tag-spacing": ["error", "never"],
  },
};
