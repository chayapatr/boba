/* eslint-disable no-empty */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Expr } from "./generator"
import type { ASTNode } from "./generator"

/* ----- Grammar notation | Code representation ----- */

// Terminal     | Code to match and consume a token
// Nonterminal  | Call to that rule’s function
// |	        | if or switch statement
// * or +       | while or for loop
// ?            | if statement

/* ----- Helper Functions ----- */

const isAtEnd = (tokens: Token[], location: number): boolean => {
    return tokens[location].type === "EOF"
}

const match = (tokens: Token[], location: number, match: TokenTypeStrings[]): boolean => {
    if(isAtEnd(tokens, location)) return false
    return match.includes(tokens[location].type) 
}

const get = (tokens: Token[], location: number): Token => {
    return tokens[location]
}

/* ----- Grammar Evaluator ----- */

type ExprFunction = (tokens: Token[], location: number) => {
    node: ASTNode
    next: number
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
            next: location + 1
        }

    if(match(tokens, location, ["TRUE", "FALSE", "NIL"])) 
        return { 
            node: Expr.Literal(bool[tokens[location].type as "TRUE" | "FALSE" | "NIL"]),
            next: location + 1
        }

    if(match(tokens, location, ["LEFT_PAREN"])) {
        const { node: expr, next } = expression(tokens, location + 1)
        if(match(tokens, next, ["RIGHT_PAREN"])) {
            return {
                node: Expr.Grouping(expr),
                next: next + 1
            }
        }
    }

    return {
        node: Expr.Literal(null),
        next: location + 1
    }
}

const binary = () => {

}

/* unary → ( "!" | "-" ) unary | primary */
const unary: ExprFunction = (tokens, location) => {
    if(match(tokens, location, ["BANG", "MINUS"])) {
        const opr = get(tokens, location)
        const { node: right, next } = unary(tokens, location + 1)
        return { node: Expr.Unary(opr, right), next }
    }
    return primary(tokens, location)
}

/* factor → unary ( ( "/" | "*" ) unary )* */
const factor: ExprFunction = (tokens, location) => {
    let { node: expr, next } = unary(tokens, location)
    let leap = next

    while(match(tokens, leap, ["SLASH", "STAR"])) {
        const opr = get(tokens, leap)
        const { node: right, next } = unary(tokens, leap + 1)
        expr = Expr.Binary(expr, opr, right)
        leap = next
    }

    return { node: expr, next: leap }
}

/* term → factor ( ( "-" | "+" ) factor )* */
const term: ExprFunction = (tokens, location) => {
    let { node: expr, next } = factor(tokens, location)
    let leap = next

    while(match(tokens, leap, ["MINUS", "PLUS"])) {
        const opr = get(tokens, leap)
        const { node: right, next } = factor(tokens, leap + 1)
        expr = Expr.Binary(expr, opr, right)
        leap = next
    }

    return { node: expr, next: leap }
}

/* comparison → term ( ( ">" | ">=" | "<" | "<=" ) term )* */
const comparison: ExprFunction = (tokens, location) => {
    let { node: expr, next } = term(tokens, location)
    let leap = next

    while(match(tokens, leap, ["GREATER", "GREATER_EQUAL", "LESS", "LESS_EQUAL"])) {
        const opr = get(tokens, leap)
        const { node: right, next } = term(tokens, leap + 1)
        expr = Expr.Binary(expr, opr, right)
        leap = next
    }

    return { node: expr, next: leap }
}

/* equality → comparison ( ( "!=" | "==" ) comparison )* */
const equality: ExprFunction = (tokens, location) => {
    let { node: expr, next } = comparison(tokens, location)
    let leap = next

    while(match(tokens, leap, ["BANG_EQUAL", "EQUAL_EQUAL"])) {
        const opr = get(tokens, leap)
        const { node: right, next } = comparison(tokens, leap + 1)
        expr = Expr.Binary(expr, opr, right)
        leap = next + 1
    }

    return { node: expr, next: leap }
}

/* expression → equality */
const expression: ExprFunction = (tokens, location) => {
    let { node, next } = equality(tokens, location)
    return { node, next }
}

/* ----- Parser ----- */

export const parse = (tokens: Token[]) => {
    const semanticTokens: Token[] = tokens.filter(token => !['NEWLINE', 'SPACE'].includes(token.type))
    return semanticTokens.length > 1 ? expression(semanticTokens, 0) : []
}