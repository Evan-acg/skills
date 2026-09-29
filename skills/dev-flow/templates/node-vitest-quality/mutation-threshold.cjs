function resolveMutationBreak(env = process.env) {
    const rawValue = env.STRYKER_BREAK
    if (rawValue === undefined || rawValue === '') return 0

    const value = Number(rawValue)
    if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error('STRYKER_BREAK must be a number between 0 and 100')
    }
    return value
}

module.exports = { resolveMutationBreak }
