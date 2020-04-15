module.exports = {
  extends: "airbnb-base",
  globals: {
    Module: true,
    Log: true,
    MM: true
  },
  parserOptions: {
    sourceType: "script"
  },
  rules: {
    strict: ["error", "global"]
  },
  env: {
    browser: true,
    node: true,
    es6: true
  }
}
