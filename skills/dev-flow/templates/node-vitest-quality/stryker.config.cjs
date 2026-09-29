const { resolveMutationBreak } = require('./scripts/quality/mutation-threshold.cjs')
const validMutationBreak = resolveMutationBreak()

module.exports = {
    testRunner: 'vitest',
    mutate: [
        'src/api/**/*.{js,ts}',
        'src/store/**/*.{js,ts}',
        'src/hooks/**/*.{js,ts}',
        'src/composables/**/*.{js,ts}',
        'src/utils/**/*.{js,ts}',
        'src/plugins/**/*.{js,ts}',
        'src/directive/**/*.{js,ts}',
        'src/components/**/composables/**/*.{js,ts}',
        'src/components/**/utils/**/*.{js,ts}',
        'src/components/**/model/**/*.{js,ts}',
        'src/components/**/engine/**/*.{js,ts}',
        'src/components/**/schema/**/*.{js,ts}',
        'src/components/**/data/**/*.{js,ts}',
        'src/components/**/store/**/*.{js,ts}',
        'src/views/**/composables/**/*.{js,ts}',
        'src/views/**/utils/**/*.{js,ts}',
        'src/views/**/store/**/*.{js,ts}',
        'src/views/**/engine/**/*.{js,ts}',
        'src/views/**/schema/**/*.{js,ts}',
        'src/views/**/data/**/*.{js,ts}',
        'src/views/**/utils.{js,ts}',
        '!src/**/*.d.ts',
        '!src/**/types.{js,ts}',
        '!src/**/*.{spec,test}.{js,ts}',
        '!src/**/__tests__/**',
        '!src/**/assets/**',
        '!src/**/vendor/**',
        '!src/**/generated/**',
        '!src/**/web-office-sdk-*',
        '!src/**/*.min.js',
        '!src/**/*.umd.js',
        '!src/**/*.esm.js',
        '!src/**/*.generated.{js,ts}'
    ],
    allowEmpty: true,
    disableTypeChecks: true,
    ignoreStatic: true,
    concurrency: 2,
    incremental: true,
    incrementalFile: 'mutation-report/stryker-incremental.json',
    reporters: ['clear-text', 'progress', 'html', 'json'],
    htmlReporter: {
        fileName: 'mutation-report/mutation.html'
    },
    jsonReporter: {
        fileName: 'mutation-report/mutation.json'
    },
    thresholds: {
        high: Math.max(80, validMutationBreak),
        low: 60,
        break: validMutationBreak
    }
}
