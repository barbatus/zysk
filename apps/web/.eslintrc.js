module.exports = {
  root: true,
  extends: [
    require.resolve('@vercel/style-guide/eslint/browser'),
    require.resolve('@vercel/style-guide/eslint/react'),
    require.resolve('@vercel/style-guide/eslint/next'),
    "@zysk/eslint-config/node-eslint.js",
  ],
  rules: {
    "@typescript-eslint/no-unnecessary-condition": "off",
    "eslint-comments/require-description": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
  },
};
