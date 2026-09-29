import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const DEFAULT_THRESHOLD = 6
const DEFAULT_CONFIG = {
    coverage: 'coverage/lcov.info',
    baseline: '.agents/crap-baseline.json',
    report: 'crap-report/crap.json',
    threshold: DEFAULT_THRESHOLD
}

const FUNCTION_KINDS = new Set([
    ts.SyntaxKind.Constructor,
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.MethodDeclaration,
    ts.SyntaxKind.GetAccessor,
    ts.SyntaxKind.SetAccessor,
    ts.SyntaxKind.ArrowFunction
])

const DECISION_KINDS = new Set([
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.ForOfStatement,
    ts.SyntaxKind.WhileStatement,
    ts.SyntaxKind.DoStatement,
    ts.SyntaxKind.CatchClause,
    ts.SyntaxKind.ConditionalExpression,
    ts.SyntaxKind.CaseClause
])

const SHORT_CIRCUIT_KINDS = new Set([
    ts.SyntaxKind.AmpersandAmpersandToken,
    ts.SyntaxKind.BarBarToken,
    ts.SyntaxKind.QuestionQuestionToken
])

function normalizePath(value) {
    return value
        .replace(/^file:\/\//, '')
        .replaceAll('\\', '/')
        .replace(/^\.\//, '')
}

function parseLcov(input) {
    const records = new Map()
    let current = null
    let functionIndex = 0

    for (const line of input.split(/\r?\n/)) {
        if (line.startsWith('SF:')) {
            const file = normalizePath(line.slice(3))
            current = {
                file,
                functions: [],
                lines: new Map()
            }
            records.set(file, current)
            functionIndex = 0
            continue
        }

        if (!current) continue

        if (line.startsWith('FN:')) {
            const separator = line.indexOf(',', 3)
            current.functions.push({
                line: Number(line.slice(3, separator)),
                name: line.slice(separator + 1),
                hits: 0
            })
            continue
        }

        if (line.startsWith('FNDA:')) {
            const separator = line.indexOf(',', 5)
            const name = line.slice(separator + 1)
            const functionRecord = current.functions.slice(functionIndex).find((item) => item.name === name)
            if (functionRecord) {
                functionRecord.hits = Number(line.slice(5, separator))
                functionIndex = current.functions.indexOf(functionRecord) + 1
            }
            continue
        }

        if (line.startsWith('DA:')) {
            const [lineNumber, hits] = line.slice(3).split(',')
            current.lines.set(Number(lineNumber), Number(hits))
            continue
        }

        if (line === 'end_of_record') {
            current.coverage = summarizeLines(current.lines)
            current = null
        }
    }

    return records
}

function summarizeLines(lines) {
    let covered = 0
    for (const hits of lines.values()) {
        if (hits > 0) covered += 1
    }
    return { covered, total: lines.size }
}

function calculateCrap(complexity, coverage) {
    return complexity ** 2 * (1 - coverage) ** 3 + complexity
}

function isFunctionLike(node) {
    return FUNCTION_KINDS.has(node.kind)
}

function getFunctionName(node, sourceFile) {
    if (node.name) return node.name.getText(sourceFile)

    const parent = node.parent
    if (ts.isVariableDeclaration(parent) && parent.name) {
        return parent.name.getText(sourceFile)
    }

    return '<anonymous>'
}

function getComplexity(node) {
    let complexity = 1

    function visit(child) {
        if (child !== node && isFunctionLike(child)) return
        if (DECISION_KINDS.has(child.kind)) {
            if (child.kind !== ts.SyntaxKind.CaseClause || child.expression) {
                complexity += 1
            }
        }
        if (ts.isBinaryExpression(child) && SHORT_CIRCUIT_KINDS.has(child.operatorToken.kind)) {
            complexity += 1
        }
        ts.forEachChild(child, visit)
    }

    ts.forEachChild(node, visit)
    return complexity
}

function discoverFunctions(source, fileName = 'source.js') {
    const scriptKind = fileName.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS
    const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind)
    const functions = []

    function visit(node) {
        if (isFunctionLike(node)) {
            const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            const end = sourceFile.getLineAndCharacterOfPosition(node.end)
            const name = getFunctionName(node, sourceFile)
            functions.push({
                name,
                startLine: start.line + 1,
                endLine: end.line + 1,
                complexity: getComplexity(node),
                sourceHash: createHash('sha1').update(node.getText(sourceFile)).digest('hex').slice(0, 12)
            })
        }
        ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return functions
}

function isAnalyzablePath(filePath) {
    const normalized = normalizePath(filePath)
    if (!normalized.startsWith('src/')) return false
    if (!/\.(?:js|ts|vue)$/.test(normalized) || normalized.endsWith('.d.ts')) return false
    if (/(?:^|\/)(?:__tests__|assets)(?:\/|$)/.test(normalized)) return false
    if (/(?:\.test|\.spec)\.(?:js|ts|vue)$/.test(normalized)) return false
    if (/(?:^|\/)generated(?:\/|$)|\.generated\./.test(normalized)) return false
    if (/(?:web-office-sdk-|\.min\.|\.umd\.|\.esm\.)/.test(normalized)) return false
    return true
}

function extractVueScript(source) {
    const matches = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    if (matches.length === 0) return null

    const masked = source.replace(/[^\n]/g, ' ')
    const script = masked.split('')
    let isTypeScript = false
    for (const match of matches) {
        const start = match.index + match[0].indexOf('>') + 1
        const content = match[2]
        isTypeScript ||= /\blang\s*=\s*["']ts["']/i.test(match[1])
        for (let index = 0; index < content.length; index += 1) {
            script[start + index] = content[index]
        }
    }

    return { source: script.join(''), isTypeScript }
}

function getSourceForAnalysis(source, relativePath) {
    if (!relativePath.endsWith('.vue')) return { source, fileName: relativePath }
    const script = extractVueScript(source)
    if (!script) return null
    return {
        source: script.source,
        fileName: script.isTypeScript ? `${relativePath}.ts` : `${relativePath}.js`
    }
}

function collectSourceFiles(root) {
    const files = []

    function visit(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolutePath = path.join(directory, entry.name)
            if (entry.isDirectory()) {
                if (!['node_modules', 'dist', 'coverage'].includes(entry.name)) visit(absolutePath)
                continue
            }

            const relativePath = normalizePath(path.relative(root, absolutePath))
            if (isAnalyzablePath(relativePath)) files.push({ absolutePath, relativePath })
        }
    }

    visit(path.join(root, 'src'))
    return files
}

function findCoverageRecord(records, relativePath) {
    if (records.has(relativePath)) return records.get(relativePath)
    const suffix = `/${relativePath}`
    return [...records.values()].find((record) => record.file.endsWith(suffix))
}

function getFunctionCoverage(functionRecord, functions, coverageRecord) {
    if (!coverageRecord) return { coverage: 0, matched: false }

    const ownedLines = []
    for (const [line, hits] of coverageRecord.lines) {
        if (line < functionRecord.startLine || line > functionRecord.endLine) continue
        const owners = functions
            .filter((candidate) => line >= candidate.startLine && line <= candidate.endLine)
            .sort((left, right) => {
                const leftSize = left.endLine - left.startLine
                const rightSize = right.endLine - right.startLine
                return leftSize - rightSize
            })
        if (owners[0] === functionRecord) ownedLines.push(hits)
    }

    if (ownedLines.length === 0) return { coverage: 0, matched: true }
    const covered = ownedLines.filter((hits) => hits > 0).length
    return { coverage: covered / ownedLines.length, matched: true }
}

function createFunctionId(functionRecord, relativePath) {
    return `${relativePath}:${functionRecord.name}:${functionRecord.sourceHash}`
}

function analyzeSources({ root, coveragePath, changedRanges = null }) {
    const coverageText = fs.readFileSync(coveragePath, 'utf8')
    const records = parseLcov(coverageText)
    const rows = []

    for (const sourceFile of collectSourceFiles(root)) {
        const source = fs.readFileSync(sourceFile.absolutePath, 'utf8')
        const analyzableSource = getSourceForAnalysis(source, sourceFile.relativePath)
        if (!analyzableSource) continue
        const allFunctions = discoverFunctions(analyzableSource.source, analyzableSource.fileName)
        const functions = changedRanges
            ? allFunctions.filter((item) => rangesIntersect(item, changedRanges.get(sourceFile.relativePath)))
            : allFunctions
        const coverageRecord = findCoverageRecord(records, sourceFile.relativePath)

        for (const functionRecord of functions) {
            const { coverage, matched } = getFunctionCoverage(functionRecord, allFunctions, coverageRecord)
            rows.push({
                id: createFunctionId(functionRecord, sourceFile.relativePath),
                file: sourceFile.relativePath,
                name: functionRecord.name,
                startLine: functionRecord.startLine,
                endLine: functionRecord.endLine,
                complexity: functionRecord.complexity,
                coverage,
                matched,
                crap: calculateCrap(functionRecord.complexity, coverage)
            })
        }
    }

    return rows.sort(
        (left, right) =>
            right.crap - left.crap ||
            left.file.localeCompare(right.file) ||
            left.startLine - right.startLine ||
            left.id.localeCompare(right.id)
    )
}

function rangesIntersect(functionRecord, ranges = []) {
    return ranges.some(([start, end]) => functionRecord.endLine >= start && functionRecord.startLine <= end)
}

function parseChangedRanges(diff) {
    const changedRanges = new Map()
    let currentFile = null

    for (const line of diff.split(/\r?\n/)) {
        if (line.startsWith('+++ b/')) {
            currentFile = normalizePath(line.slice(6))
            if (isAnalyzablePath(currentFile) && !changedRanges.has(currentFile)) {
                changedRanges.set(currentFile, [])
            }
            continue
        }

        const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
        if (!match || !currentFile || !changedRanges.has(currentFile)) continue
        const start = Number(match[1])
        const count = Number(match[2] ?? 1)
        if (count === 0) continue
        changedRanges.get(currentFile).push([start, start + Math.max(count, 1) - 1])
    }

    return changedRanges
}

function getChangedRanges(root, base) {
    const diff = execFileSync('git', ['diff', '--unified=0', `${base}...HEAD`, '--', 'src'], {
        cwd: root,
        encoding: 'utf8'
    })
    return parseChangedRanges(diff)
}

function loadConfig(root) {
    const configPath = path.join(root, 'crap.config.json')
    if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG }
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }
}

function loadBaseline(root, baselinePath) {
    if (!baselinePath) return null
    const absolutePath = path.resolve(root, baselinePath)
    if (!fs.existsSync(absolutePath)) return null
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
}

function applyThreshold(rows, threshold, baseline) {
    const waivers = new Map((baseline?.waivers ?? []).map((item) => [item.id, item]))
    return rows.map((row) => {
        const breach = row.crap > threshold
        const waiver = waivers.get(row.id)
        const waived = breach && waiver && row.crap <= waiver.crap
        return {
            ...row,
            status: !breach ? 'pass' : waived ? 'waived' : 'fail'
        }
    })
}

function createReport({ rows, threshold, mode, base = null }) {
    const breaches = rows.filter((row) => row.crap > threshold)
    return {
        mode,
        threshold,
        base,
        summary: {
            files: new Set(rows.map((row) => row.file)).size,
            functions: rows.length,
            unwaivedBreaches: rows.filter((row) => row.status === 'fail').length,
            waived: rows.filter((row) => row.status === 'waived').length,
            maxCrap: rows.length ? Math.max(...rows.map((row) => row.crap)) : 0
        },
        functions: rows,
        thresholdBreaches: breaches.length
    }
}

function formatReport(report) {
    const lines = [
        `CRAP ${report.mode} | threshold ${report.threshold} | ${report.summary.functions} functions`,
        `Files: ${report.summary.files} | Threshold breaches: ${report.thresholdBreaches} | Unwaived: ${report.summary.unwaivedBreaches} | Waived: ${report.summary.waived}`
    ]
    for (const row of report.functions.filter((item) => item.crap > report.threshold)) {
        lines.push(
            `${row.status.toUpperCase()} ${row.crap.toFixed(2)} ${row.file}:${row.startLine} ${row.name} (CC ${row.complexity}, coverage ${(row.coverage * 100).toFixed(1)}%)`
        )
    }
    return lines.join('\n')
}

function parseArguments(argv) {
    const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'report'
    if (!['report', 'check', 'baseline'].includes(command)) {
        throw new Error(`Unknown command: ${command}`)
    }
    const options = { command }
    const start = options.command === 'report' && argv[0]?.startsWith('--') ? 0 : 1

    for (let index = start; index < argv.length; index += 1) {
        const argument = argv[index]
        if (argument === '--changed') options.changed = true
        else if (argument === '--no-baseline') options.noBaseline = true
        else if (argument.startsWith('--')) {
            const [key, inlineValue] = argument.split('=', 2)
            const value = inlineValue ?? argv[++index]
            if (key === '--root') options.root = value
            else if (key === '--coverage') options.coverage = value
            else if (key === '--baseline') options.baseline = value
            else if (key === '--output') options.output = value
            else if (key === '--threshold') options.threshold = Number(value)
            else if (key === '--base') options.base = value
            else throw new Error(`Unknown option: ${key}`)
        } else {
            throw new Error(`Unexpected argument: ${argument}`)
        }
    }
    return options
}

function gitHead(root) {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    } catch {
        return 'unknown'
    }
}

function writeBaseline(root, report, baselinePath) {
    const outputPath = path.resolve(root, baselinePath)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    const waivers = report.functions
        .filter((row) => row.crap > report.threshold)
        .map((row) => ({ id: row.id, crap: row.crap }))
    fs.writeFileSync(
        outputPath,
        `${JSON.stringify(
            {
                version: 1,
                generatedCommit: gitHead(root),
                threshold: report.threshold,
                waivers
            },
            null,
            4
        )}\n`
    )
}

function run(argv = process.argv.slice(2)) {
    const options = parseArguments(argv)
    const root = path.resolve(options.root ?? process.cwd())
    const config = loadConfig(root)
    const threshold = options.threshold ?? config.threshold
    const coveragePath = path.resolve(root, options.coverage ?? config.coverage)
    const baselinePath = options.baseline ?? config.baseline
    const mode = options.changed ? 'changed' : 'full'
    if (options.changed && !options.base && !process.env.CRAP_BASE) {
        throw new Error('Changed-only CRAP requires --base or CRAP_BASE')
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
        throw new Error('CRAP threshold must be a non-negative number')
    }

    const changedRanges = options.changed ? getChangedRanges(root, options.base ?? process.env.CRAP_BASE) : null

    const rows = analyzeSources({ root, coveragePath, changedRanges })
    const baseline = options.noBaseline ? null : loadBaseline(root, baselinePath)
    const report = createReport({
        rows: applyThreshold(rows, threshold, baseline),
        threshold,
        mode,
        base: options.base ?? process.env.CRAP_BASE ?? null
    })

    if (options.command === 'baseline') {
        writeBaseline(root, report, baselinePath)
    } else {
        const outputPath = path.resolve(root, options.output ?? config.report)
        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    }

    process.stdout.write(`${formatReport(report)}\n`)
    if (options.command === 'check' && report.summary.unwaivedBreaches > 0) return 1
    return 0
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
    try {
        process.exitCode = run()
    } catch (error) {
        process.stderr.write(`CRAP error: ${error.message}\n`)
        process.exitCode = 1
    }
}

export {
    analyzeSources,
    calculateCrap,
    discoverFunctions,
    extractVueScript,
    isAnalyzablePath,
    parseChangedRanges,
    parseLcov,
    run
}
