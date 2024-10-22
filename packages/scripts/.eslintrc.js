const { run } = require("node:test");

module.exports = {
  root: true,
  extends: ["@zysk/eslint-config/node-eslint.js"],
  ignorePatterns: ["/*", "!/src"],
  rules: {
    "no-console": "off",
  },
};
