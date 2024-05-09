import { scan } from "./scanner"
import { parse } from "./parser"

export const run = (source: string) => {
    const scanned = scan(source)
    const parsed = scanned.success ? parse(scanned.tokens) : { node: [], next: 0 }
    
    return { scanned, parsed }
}