module.exports = {
  root: true,
  extends: [
    "@zysk/eslint-config/node-eslint.js",
    require.resolve('@vercel/style-guide/eslint/browser'),
  ],
  ignorePatterns: ["/*", "!/src"],
};
