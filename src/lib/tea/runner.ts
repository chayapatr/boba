import { scan } from "./scanner"
// import { parse } from "./parser"

export const run = (source: string) => {
    const tokens = scan(source)
    // const ast = parse(tokens)
    // return ast
    return tokens
}