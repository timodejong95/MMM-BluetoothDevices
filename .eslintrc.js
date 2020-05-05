module.exports = {
  extends: "airbnb-base",
  globals: {
    Module: true,
    Log: true,
    MM: true,
    describe: true,
    it: true
  },
  parserOptions: {
    sourceType: "script"
  },
  rules: {
    strict: ["error", "global"],
    radix: "off",
    "no-async-promise-executor": "off",
    "no-mixed-operators": "off",
    "no-case-declarations": "off",
    "class-methods-use-this": "off",
    "prefer-destructuring": "off",
    "guard-for-in": "off",
    "no-param-reassign": "off",
    "no-restricted-syntax": "off",
  },
  env: {
    browser: true,
    node: true,
    es6: true
  }
};
