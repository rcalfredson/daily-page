// eslint.config.js
import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import n from "eslint-plugin-n";
import promise from "eslint-plugin-promise";

const readonly = "readonly";

const nodeGlobals = {
  Buffer: readonly,
  console: readonly,
  clearImmediate: readonly,
  clearInterval: readonly,
  clearTimeout: readonly,
  fetch: readonly,
  global: readonly,
  process: readonly,
  setImmediate: readonly,
  setInterval: readonly,
  setTimeout: readonly,
  URL: readonly,
  URLSearchParams: readonly,
};

const browserGlobals = {
  Blob: readonly,
  CodeMirror: readonly,
  CustomEvent: readonly,
  Element: readonly,
  Event: readonly,
  File: readonly,
  FileReader: readonly,
  FormData: readonly,
  Image: readonly,
  KeyboardEvent: readonly,
  MouseEvent: readonly,
  MutationObserver: readonly,
  Node: readonly,
  NodeList: readonly,
  Peer: readonly,
  SimpleMDE: readonly,
  URL: readonly,
  URLSearchParams: readonly,
  alert: readonly,
  backendURL: readonly,
  cancelAnimationFrame: readonly,
  clearInterval: readonly,
  clearTimeout: readonly,
  confirm: readonly,
  console: readonly,
  document: readonly,
  fetch: readonly,
  history: readonly,
  jQuery: readonly,
  localStorage: readonly,
  location: readonly,
  month: readonly,
  navigator: readonly,
  requestAnimationFrame: readonly,
  room: readonly,
  sessionStorage: readonly,
  setInterval: readonly,
  setTimeout: readonly,
  window: readonly,
  year: readonly,
  $: readonly,
};

const jasmineGlobals = {
  afterAll: readonly,
  afterEach: readonly,
  beforeAll: readonly,
  beforeEach: readonly,
  describe: readonly,
  expect: readonly,
  expectAsync: readonly,
  fail: readonly,
  fit: readonly,
  fdescribe: readonly,
  it: readonly,
  jasmine: readonly,
  pending: readonly,
  spyOn: readonly,
  xdescribe: readonly,
  xit: readonly,
};

export default [
  {
    ignores: [
      "public/js/bundle.js",
      "public/js/*.min.js",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      import: importPlugin,
      n,
      promise,
    },
    rules: {
      // Tu regla personalizada de .eslintrc.json
      "import/extensions": [
        "error",
        "ignorePackages",
        { ".js": "never" },
      ],
    },
  },
  {
    files: [
      "app.js",
      "config/**/*.js",
      "mp3ToGoogleDoc.js",
      "performance/**/*.js",
      "scripts/**/*.js",
      "server/**/*.js",
    ],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: [
      "lib/**/*.js",
      "public/js/**/*.js",
    ],
    languageOptions: {
      globals: browserGlobals,
    },
  },
  {
    files: ["spec/**/*.js"],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        ...browserGlobals,
        ...jasmineGlobals,
      },
    },
  },
];
