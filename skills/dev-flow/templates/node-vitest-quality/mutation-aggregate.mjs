import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import threshold from './mutation-threshold.cjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function parseArguments(argv) {
    const options = { directory: null, expected: null, output: 'mutation-aggregate/mutation-summary.json' }
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index]
        if (argument === '--dir') options.directory = argv[++index]
        else if (argument === '--expected') options.expected = Number(argv[++index])
        else if (argument === '--output') options.output = argv[++index]
        else throw new Error(`Unknown option: ${argument}`)
    }
    return options
}

function findReports(directory) {
    if (!fs.existsSync(directory)) return []
    const reports = []
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name)
        if (entry.isDirectory()) reports.push(...findReports(entryPath))
        else if (entry.name === 'mutation.json') reports.push(entryPath)
    }
    return reports
}

export function summarizeMutationReports(reports) {
    const mutants = reports.flatMap((report) => Object.values(report.files ?? {}).flatMap((file) => file.mutants ?? []))
    const counts = mutants.reduce((result, mutant) => {
        result[mutant.status] = (result[mutant.status] ?? 0) + 1
        return result
    }, {})
    const ignored = counts.Ignored ?? 0
    const killed = counts.Killed ?? 0
    const timeout = counts.Timeout ?? 0
    const survived = counts.Survived ?? 0
    const noCoverage = counts.NoCoverage ?? 0
    const totalDetected = killed + timeout
    const measured = totalDetected + survived + noCoverage
    const mutationScore = measured === 0 ? 100 : (totalDetected / measured) * 100

    return {
        status: mutants.length === 0 ? 'skipped' : 'completed',
        reports: reports.length,
        mutants: mutants.length,
        measured,
        killed,
        timeout,
        survived,
        noCoverage,
        ignored,
        mutationScore: Number(mutationScore.toFixed(2)),
        counts
    }
}

export function aggregateMutationReports({ directory, expected = null, output } = {}) {
    const reportPaths = findReports(directory)
    if (expected !== null && reportPaths.length < expected) {
        throw new Error(`Expected ${expected} mutation reports, found ${reportPaths.length}`)
    }
    if (reportPaths.length === 0) throw new Error(`No mutation reports found in ${directory}`)

    const summary = summarizeMutationReports(
        reportPaths.map((reportPath) => JSON.parse(fs.readFileSync(reportPath, 'utf8')))
    )
    const outputPath = path.resolve(REPO_ROOT, output)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`)
    return summary
}

export function run(argv = process.argv.slice(2)) {
    const options = parseArguments(argv)
    if (!options.directory) throw new Error('Mutation report aggregation requires --dir')
    if (options.expected !== null && (!Number.isInteger(options.expected) || options.expected < 1)) {
        throw new Error('--expected must be a positive integer')
    }

    const summary = aggregateMutationReports({
        directory: path.resolve(REPO_ROOT, options.directory),
        expected: options.expected,
        output: options.output
    })
    const mutationBreak = threshold.resolveMutationBreak()
    console.log(
        `[mutation] aggregate reports=${summary.reports} mutants=${summary.mutants} score=${summary.mutationScore} break=${mutationBreak}`
    )
    return summary.mutationScore >= mutationBreak ? 0 : 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        process.exitCode = run()
    } catch (error) {
        console.error(`[mutation] ${error.message}`)
        process.exitCode = 1
    }
}
