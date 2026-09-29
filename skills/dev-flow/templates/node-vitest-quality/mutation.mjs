import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import threshold from './mutation-threshold.cjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SOURCE_FILE = /\.(?:js|ts)$/i
const TEST_FILE = /(?:^|\/)(?:[^/]+\.(?:spec|test)\.(?:js|ts)|__tests__)(?:\/|$)/i
const EXCLUDED_SOURCE =
    /(?:^|\/)(?:assets|vendor|generated)(?:\/|$)|web-office-sdk-|\.d\.ts$|(?:^|\/)types\.(?:js|ts)$|\.generated\.(?:js|ts)$|\.(?:min|umd|esm)\.(?:js|ts)$/i
const LOGIC_SOURCE =
    /^(?:src\/(?:api|store|hooks|composables|utils|plugins|directive)\/|src\/components\/(?:.+\/)?(?:composables|utils|model|engine|schema|data|store)\/|src\/views\/(?:.+\/)?(?:composables|utils|engine|schema|data|store)\/|src\/views\/(?:.+\/)?utils\.(?:js|ts)$)/i

function normalizePath(file) {
    return file.replaceAll('\\', '/')
}

export function filterMutationFiles(files) {
    return files
        .map(normalizePath)
        .filter(
            (file) =>
                LOGIC_SOURCE.test(file) &&
                SOURCE_FILE.test(file) &&
                !TEST_FILE.test(file) &&
                !EXCLUDED_SOURCE.test(file)
        )
}

export function partitionMutationFiles(files, shardIndex = null, shardTotal = null) {
    if (shardIndex === null || shardTotal === null) return files

    const shards = Array.from({ length: shardTotal }, () => [])
    files
        .map(normalizePath)
        .sort()
        .forEach((file, index) => shards[index % shardTotal].push(file))
    return shards[shardIndex]
}

export const { resolveMutationBreak } = threshold

export function validateMutationWaiverText(source) {
    const invalidLines = []
    const lineNumberAt = (index) => source.slice(0, index).split(/\r?\n/).length

    for (const match of source.matchAll(/\/\*\s*Stryker disable\b([\s\S]*?)(?:\*\/|$)/gi)) {
        if (!/:\s*\S/.test(match[1])) invalidLines.push(lineNumberAt(match.index))
    }
    for (const match of source.matchAll(/\/\/\s*Stryker disable\b([^\r\n]*)/gi)) {
        if (!/:\s*\S/.test(match[1])) invalidLines.push(lineNumberAt(match.index))
    }

    return [...new Set(invalidLines)].sort((left, right) => left - right)
}

export function buildMutationArgs({
    changedFiles = null,
    mutationFiles = null,
    shardIndex = null,
    shardTotal = null
} = {}) {
    if (changedFiles || mutationFiles) {
        const files = filterMutationFiles(changedFiles ?? mutationFiles)
        const selectedFiles = partitionMutationFiles(files, shardIndex, shardTotal)
        if (selectedFiles.length === 0) return { skip: true, args: [] }
        const args = ['run', '--mutate', selectedFiles.join(',')]
        if (shardIndex !== null) {
            args.push('--incrementalFile', `mutation-report/stryker-incremental-${shardIndex}.json`)
        }
        return { skip: false, args }
    }

    return { skip: false, args: ['run'] }
}

function git(args) {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
}

function parseArguments(argv) {
    const options = { changed: false, base: null, shardIndex: null, shardTotal: null, plan: false }
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index]
        if (argument === '--changed') options.changed = true
        else if (argument === '--base') options.base = argv[++index]
        else if (argument === '--shard-index') options.shardIndex = Number(argv[++index])
        else if (argument === '--shard-total') options.shardTotal = Number(argv[++index])
        else if (argument === '--plan') options.plan = true
        else throw new Error(`Unknown option: ${argument}`)
    }
    return options
}

function changedFiles(base) {
    const output = git(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`, '--', 'src'])
    return output ? output.split(/\r?\n/).filter(Boolean) : []
}

function validateMutationWaivers() {
    const files = filterMutationFiles(git(['ls-files', 'src']).split(/\r?\n/).filter(Boolean))
    const invalid = files.flatMap((file) =>
        validateMutationWaiverText(fs.readFileSync(path.join(REPO_ROOT, file), 'utf8')).map((line) => `${file}:${line}`)
    )
    if (invalid.length > 0) {
        throw new Error(`Mutation waivers require an equivalent-mutant reason: ${invalid.join(', ')}`)
    }
}

function writeEmptyReport({ mode, shardIndex, shardTotal }) {
    const reportDir = path.join(REPO_ROOT, 'mutation-report')
    fs.mkdirSync(reportDir, { recursive: true })
    fs.writeFileSync(
        path.join(reportDir, 'mutation.json'),
        `${JSON.stringify(
            {
                mode,
                status: 'skipped',
                reason: 'No eligible production JavaScript or TypeScript files selected for this mutation run.',
                ...(shardIndex === null ? {} : { shard: { index: shardIndex, total: shardTotal } })
            },
            null,
            2
        )}\n`
    )
}

function runStryker(args) {
    const bin = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'stryker.cmd' : 'stryker')
    const result =
        process.platform === 'win32'
            ? spawnSync([bin, ...args].map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(' '), {
                  cwd: REPO_ROOT,
                  env: process.env,
                  stdio: 'inherit',
                  shell: true
              })
            : spawnSync(bin, args, { cwd: REPO_ROOT, env: process.env, stdio: 'inherit' })
    return result.status ?? 1
}

export function run(argv = process.argv.slice(2)) {
    const options = parseArguments(argv)
    if (options.changed && !options.base) throw new Error('Changed-only mutation testing requires --base')
    if ((options.shardIndex === null) !== (options.shardTotal === null)) {
        throw new Error('Mutation sharding requires both --shard-index and --shard-total')
    }
    if (
        options.shardIndex !== null &&
        (!Number.isInteger(options.shardIndex) ||
            !Number.isInteger(options.shardTotal) ||
            options.shardTotal < 1 ||
            options.shardIndex < 0 ||
            options.shardIndex >= options.shardTotal)
    ) {
        throw new Error('Mutation shard index must be an integer within the shard total')
    }
    const mutationBreak = resolveMutationBreak()
    validateMutationWaivers()

    const changed = options.changed ? changedFiles(options.base) : null
    const mutation = buildMutationArgs({
        changedFiles: changed,
        mutationFiles: options.shardIndex === null ? null : git(['ls-files', 'src']).split(/\r?\n/).filter(Boolean),
        shardIndex: options.shardIndex,
        shardTotal: options.shardTotal
    })
    if (options.plan) {
        console.log(`has-files=${mutation.skip ? 'false' : 'true'}`)
        return 0
    }
    if (mutation.skip) {
        writeEmptyReport({
            mode: options.changed ? 'changed' : 'full',
            shardIndex: options.shardIndex,
            shardTotal: options.shardTotal
        })
        console.log('[mutation] no eligible production files selected; skipping Stryker')
        return 0
    }

    const mutateIndex = mutation.args.indexOf('--mutate')
    const fileCount = mutateIndex === -1 ? 'all' : mutation.args[mutateIndex + 1].split(',').length
    console.log(
        `[mutation] mode=${options.changed ? 'changed' : 'full'} break=${mutationBreak} files=${fileCount}` +
            (options.shardIndex === null ? '' : ` shard=${options.shardIndex + 1}/${options.shardTotal}`)
    )
    return runStryker(mutation.args)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        process.exitCode = run()
    } catch (error) {
        console.error(`[mutation] ${error.message}`)
        process.exitCode = 1
    }
}
