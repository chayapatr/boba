import { scan } from "./scanner"
// import { parse } from "./parser"

export const run = (source: string) => {
    const { success, tokens } = scan(source)
    // const ast = parse(tokens)
    
    // return ast
    return { success, tokens }
}