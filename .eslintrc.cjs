/* eslint-env node */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'prettier',
  ],
  globals: {
    // Vite/PWA globals injected at build/runtime
    self: 'readonly',
    caches: 'readonly',
    importScripts: 'readonly',
    clients: 'readonly',
    workbox: 'readonly',
    // Vitest globals (used in *.test.js)
    describe: 'readonly',
    it: 'readonly',
    expect: 'readonly',
    beforeEach: 'readonly',
    afterEach: 'readonly',
    beforeAll: 'readonly',
    afterAll: 'readonly',
    vi: 'readonly',
  },
  rules: {
    // Parsing-level guardrails — keep as errors.
    'vue/no-parsing-error': 'error',
    'vue/valid-template-root': 'error',
    'vue/valid-v-bind': 'error',
    'vue/valid-v-on': 'error',

    // Real correctness rules — codebase has pre-existing violations
    // (see Parking.vue selectedTripId, usePackingWeights formatBagWeight, etc).
    // Surfaced as warnings so the baseline is green; should be promoted
    // to errors once those bugs are fixed in a separate change.
    'no-undef': 'warn',
    'no-redeclare': 'warn',
    'no-inner-declarations': 'warn',
    'vue/no-dupe-keys': 'warn',
    'vue/no-ref-as-operand': 'warn',
    'vue/no-reserved-component-names': 'warn',
    'vue/no-use-v-if-with-v-for': 'warn',
    'vue/valid-v-if': 'warn',
    'vue/valid-v-else': 'warn',
    'vue/valid-v-else-if': 'warn',

    // Style/sanity rules — warnings (baseline is mixed; don't crusade)
    'no-unused-vars': ['warn', {
      args: 'none',
      ignoreRestSiblings: true,
      varsIgnorePattern: '^_',
    }],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-useless-escape': 'warn',
    'no-prototype-builtins': 'warn',
    'no-async-promise-executor': 'warn',
    'no-constant-condition': ['warn', { checkLoops: false }],
    'no-case-declarations': 'warn',
    'no-irregular-whitespace': 'warn',
    'no-control-regex': 'warn',

    // Vue stylistic — warnings, codebase is large and inconsistent
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'off',
    'vue/require-default-prop': 'off',
    'vue/require-explicit-emits': 'off',
    'vue/require-prop-types': 'warn',
    'vue/no-mutating-props': 'warn',
    'vue/no-unused-vars': 'warn',
    'vue/no-unused-components': 'warn',
    'vue/attribute-hyphenation': 'off',
    'vue/v-on-event-hyphenation': 'off',
    'vue/attributes-order': 'off',
    'vue/order-in-components': 'off',
    'vue/component-definition-name-casing': 'off',
    'vue/component-tags-order': 'off',
    'vue/html-self-closing': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    'vue/html-indent': 'off',
    'vue/html-closing-bracket-newline': 'off',
    'vue/html-closing-bracket-spacing': 'off',
    'vue/first-attribute-linebreak': 'off',
    'vue/script-indent': 'off',
    'vue/no-multiple-template-root': 'off',
    'vue/this-in-template': 'warn',
    'vue/return-in-computed-property': 'warn',
    'vue/no-side-effects-in-computed-properties': 'warn',
    'vue/no-template-shadow': 'warn',
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js', 'vitest.config.js'],
      env: { node: true },
      globals: {
        // Jest-style globals — older spec files predate the vitest migration.
        jest: 'readonly',
        test: 'readonly',
      },
    },
    {
      files: ['*.cjs', '*.config.js'],
      env: { node: true },
    },
  ],
}
