import { scan } from "./scanner"
import { parse } from "./parser"
import { interpret } from "./interpreter"

export const run = (source: string) => {
    const scanned = scan(source)
    const parsed = scanned.success
        ? parse(scanned.tokens)
        : { nodes: [], error: "" }
    const interpreted = parsed.error
        ? { output: [], error: null }
        : interpret(parsed.nodes)
    return { scanned, parsed, interpreted }
}
