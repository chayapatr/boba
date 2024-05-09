const error = (line: number, message: string) => {
    report(line, "", message)
}

const report = (line: number, where: string, message: string) => {
    // had error = true
    return `[line ${line}] Error ${where}: ${message}`
}

export { error, report }