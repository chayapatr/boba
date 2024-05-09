import { scan } from "./scanner"
import { parse } from "./parser"

export const run = (source: string) => {
    const { success, tokens, msg } = scan(source)
    const ast = parse(tokens)
    
    return { success, tokens, msg }
}