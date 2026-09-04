import globals from 'globals';

// ESLint flat config.
// Errors = things that are almost certainly bugs (undefined variables,
// duplicate declarations/keys, reassigning consts).
// Warnings = style/cleanliness nudges — visible locally, never red in CI.
export default [
    {
        ignores: ['node_modules/**', 'data/**', 'uploads/**', '.git/**', '.utim_tmp/**'],
    },
    {
        files: ['index.js', 'src/**/*.js', 'test/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: globals.node,
        },
        rules: {
            // ── Bugs (fail the build) ──
            'no-undef': 'error',
            'no-redeclare': 'error',
            'no-dupe-keys': 'error',
            'no-dupe-class-members': 'error',
            'no-const-assign': 'error',
            'no-unreachable': 'warn',
            'no-fallthrough': 'warn',
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-constant-condition': ['warn', { checkLoops: false }],

            // ── Cleanliness (advisory only) ──
            'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', args: 'after-used', caughtErrors: 'none' }],
            'prefer-const': 'warn',
            'no-var': 'warn',
            eqeqeq: 'warn',
        },
    },
    // The dashboard frontend runs in the browser and shares helpers across
    // ES modules (import/export), so unused-name checks don't apply there.
    // no-undef stays on for a *per-module* view; the window bridge in
    // 00-entry.mjs deliberately assigns to window, so allow that pattern.
    {
        files: ['src/dashboard/parts/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: globals.browser,
        },
        rules: {
            'no-unused-vars': 'off',
            'no-redeclare': 'off', // legacy for-loop `var` reuse is pervasive here
            'no-unreachable': 'off', // legacy single-file dead code still applies
            'no-constant-condition': 'off',
            'no-empty': 'off',
            'no-undef': ['error', { typeof: true }],
        },
    },
];
