import { Expr } from "./generator"
import type { ASTNode } from "./generator"

/* ----- Helper Functions ----- */

const isAtEnd = (tokens: Token[], location: number): boolean => {
    return location >= tokens.length ?? tokens[location].type === "EOF"
}

const match = (tokens: Token[], location: number, match: TokenTypeStrings[]): boolean => {
    if(isAtEnd(tokens, location)) return false
    return match.includes(tokens[location].type) 
}

const get = (tokens: Token[], location: number): Token => {
    return tokens[location]
}

/* ----- Expression Evaluator ----- */

type ExprFunction = (tokens: Token[], location: number) => {
    node: ASTNode
    next: number
    error: string
};

/* primary → NUMBER | STRING | "true" | "false" | "nil" | "(" expression ")" */
const primary: ExprFunction = (tokens, location) => {

    const bool = {
        "TRUE": true,
        "FALSE": false,
        "NIL": null
    }

    if(match(tokens, location, ["NUMBER", "STRING"]))
        return {
            node: Expr.Literal(tokens[location].literal as string | number),
            next: location + 1,
            error: ""
        }

    if(match(tokens, location, ["TRUE", "FALSE", "NIL"])) 
        return { 
            node: Expr.Literal(bool[tokens[location].type as "TRUE" | "FALSE" | "NIL"]),
            next: location + 1,
            error: ""
        }

    if(match(tokens, location, ["LEFT_PAREN"])) {
        const { node: expr, next } = expression(tokens, location + 1)
        if(match(tokens, next, ["RIGHT_PAREN"])) {
            return {
                node: Expr.Grouping(expr),
                next: next + 1,
                error: ""
            }
        } else {
            return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location}] → PARENTHESIS NOT CLOSE` }
        }
    }

    console.log(location, tokens[location])

    if(match(tokens, location, ["RIGHT_PAREN"])) {
        return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location}] → UNEXPECTED RIGHT PAREN` }
    }

    if(match(tokens, location, ["EOF"])) {
        return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location}] → UNEXPECTED EOF (AFTER '${tokens[location - 1].lexeme}')` }
    }

    return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location}] → UNEXPECTED CHARACTER '${tokens[location].lexeme}', ` }
}

/* unary → ( "!" | "-" ) unary | primary */
const unary: ExprFunction = (tokens, location) => {
    if(match(tokens, location, ["BANG", "MINUS"])) {
        const opr = get(tokens, location)
        const { node: right, next, error } = unary(tokens, location + 1)
        return { node: Expr.Unary(opr, right), next, error }
    }
    return primary(tokens, location)
}

/* BinaryExpr → EXPR ( ( OPR ) EXPR )* */
const BinaryExprGenerator = (tokens: Token[], location: number, expr: ExprFunction, opr: TokenTypeStrings[]) => {
    // eslint-disable-next-line prefer-const
    let { node, next, error } = expr(tokens, location)
    let leap = next

    while(match(tokens, leap, opr)) {
        const opr = get(tokens, leap)
        const { node: right, next, error: nextError } = expr(tokens, leap + 1)
        error += nextError
        node = Expr.Binary(node, opr, right)
        leap = next
    }

    return { node, next: leap, error }
}

/* factor → unary ( ( "/" | "*" ) unary )* */
const factor: ExprFunction = (tokens, location) => BinaryExprGenerator(tokens, location, unary, ["SLASH", "STAR"])

/* term → factor ( ( "-" | "+" ) factor )* */
const term: ExprFunction = (tokens, location) => BinaryExprGenerator(tokens, location, factor, ["MINUS", "PLUS"])

/* comparison → term ( ( ">" | ">=" | "<" | "<=" ) term )* */
const comparison: ExprFunction = (tokens, location) => BinaryExprGenerator(tokens, location, term, ["GREATER", "GREATER_EQUAL", "LESS", "LESS_EQUAL"])

/* equality → comparison ( ( "!=" | "==" ) comparison )* */
const equality: ExprFunction = (tokens, location) => BinaryExprGenerator(tokens, location, comparison, ["BANG_EQUAL", "EQUAL_EQUAL"])

/* expression → equality */
const expression: ExprFunction = (tokens, location) => {
    return equality(tokens, location)
}

/* ----- Parser ----- */

export const parse = (tokens: Token[]): { node: ASTNode | undefined, next: number } => {
    const semanticTokens: Token[] = tokens.filter(token => !['NEWLINE', 'SPACE'].includes(token.type))
    // const AST: ASTNode[] = []
    // let current = 0
    // do {
    //     console.log("START AT", current)
    //     const { node, next } = expression(semanticTokens, current)
    //     AST.push(node)
    //     current = next
    // } while (current < semanticTokens.length - 1)
    return semanticTokens.length > 1 ? expression(semanticTokens, 0) : { node: undefined, next: -1 }
}