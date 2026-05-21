import { Expr, Stmt } from "./generator"
import type { ASTNode } from "./generator"

/* ----- Helpers ----- */

const isAtEnd = (tokens: Token[], location: number): boolean =>
    location >= tokens.length || tokens[location].type === "EOF"

const match = (tokens: Token[], location: number, types: TokenTypeStrings[]): boolean => {
    if (isAtEnd(tokens, location)) return false
    return types.includes(tokens[location].type)
}

const get = (tokens: Token[], location: number): Token => tokens[location]

/* ----- Expression parsing (Pratt) ----- */

type ExprResult = { node: ASTNode; next: number; error: string }
type ExprFn = (tokens: Token[], location: number) => ExprResult

const primary: ExprFn = (tokens, location) => {
    const bool: Record<string, boolean | null> = { TRUE: true, FALSE: false, NIL: null }

    if (match(tokens, location, ["NUMBER", "STRING"]))
        return { node: Expr.Literal(tokens[location].literal as string | number), next: location + 1, error: "" }

    if (match(tokens, location, ["TRUE", "FALSE", "NIL"]))
        return { node: Expr.Literal(bool[tokens[location].type as "TRUE" | "FALSE" | "NIL"]), next: location + 1, error: "" }

    if (match(tokens, location, ["IDENTIFIER"]))
        return { node: Expr.Variable(get(tokens, location)), next: location + 1, error: "" }

    if (match(tokens, location, ["LEFT_PAREN"])) {
        const { node: expr, next, error } = expression(tokens, location + 1)
        if (match(tokens, next, ["RIGHT_PAREN"]))
            return { node: Expr.Grouping(expr), next: next + 1, error }
        return { node: Expr.Literal(null), next: location + 1, error: error || `[TOKEN ${location}] PARENTHESIS NOT CLOSED` }
    }

    // Array literal: [ expr, expr, ... ]
    if (match(tokens, location, ["LEFT_BRACKET"])) {
        const elements: ASTNode[] = []
        let cur = location + 1
        let error = ""
        while (!isAtEnd(tokens, cur) && !match(tokens, cur, ["RIGHT_BRACKET"])) {
            const { node, next, error: e } = expression(tokens, cur)
            elements.push(node)
            error += e
            cur = next
            if (match(tokens, cur, ["COMMA"])) cur++
        }
        if (!match(tokens, cur, ["RIGHT_BRACKET"]))
            return { node: Expr.Literal(null), next: cur, error: error + ` [TOKEN ${cur}] EXPECTED ']'` }
        return { node: Expr.Array(elements), next: cur + 1, error }
    }

    if (match(tokens, location, ["RIGHT_PAREN"]))
        return { node: Expr.Literal(null), next: location, error: `[TOKEN ${location}] UNEXPECTED RIGHT PAREN` }

    if (match(tokens, location, ["EOF"]))
        return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location}] UNEXPECTED EOF` }

    return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location}] UNEXPECTED TOKEN '${tokens[location].lexeme}'` }
}

// call/index: handles f(args) and a[i] postfix operators
const callOrIndex: ExprFn = (tokens, location) => {
    let { node, next, error } = primary(tokens, location)

    while (true) {
        if (match(tokens, next, ["LEFT_PAREN"])) {
            // function call
            const args: ASTNode[] = []
            let cur = next + 1
            while (!isAtEnd(tokens, cur) && !match(tokens, cur, ["RIGHT_PAREN"])) {
                const { node: arg, next: n2, error: e } = expression(tokens, cur)
                args.push(arg)
                error += e
                cur = n2
                if (match(tokens, cur, ["COMMA"])) cur++
            }
            if (!match(tokens, cur, ["RIGHT_PAREN"])) {
                error += ` [TOKEN ${cur}] EXPECTED ')' AFTER ARGS`
            } else {
                cur++
            }
            node = Expr.Call(node, args)
            next = cur
        } else if (match(tokens, next, ["LEFT_BRACKET"])) {
            // index access a[i]
            const { node: idx, next: n2, error: e } = expression(tokens, next + 1)
            error += e
            if (!match(tokens, n2, ["RIGHT_BRACKET"])) {
                error += ` [TOKEN ${n2}] EXPECTED ']'`
                next = n2
            } else {
                next = n2 + 1
            }
            node = Expr.Index(node, idx)
        } else {
            break
        }
    }

    return { node, next, error }
}

const unary: ExprFn = (tokens, location) => {
    if (match(tokens, location, ["BANG", "MINUS"])) {
        const opr = get(tokens, location)
        const { node: right, next, error } = unary(tokens, location + 1)
        return { node: Expr.Unary(opr, right), next, error }
    }
    return callOrIndex(tokens, location)
}

const binaryGen = (tokens: Token[], location: number, sub: ExprFn, ops: TokenTypeStrings[]): ExprResult => {
    let { node, next, error } = sub(tokens, location)
    while (match(tokens, next, ops)) {
        const opr = get(tokens, next)
        const { node: right, next: n2, error: e2 } = sub(tokens, next + 1)
        error += e2
        node = Expr.Binary(node, opr, right)
        next = n2
    }
    return { node, next, error }
}

const factor: ExprFn = (t, l) => binaryGen(t, l, unary, ["SLASH", "STAR"])
const term: ExprFn   = (t, l) => binaryGen(t, l, factor, ["MINUS", "PLUS"])
const comparison: ExprFn = (t, l) => binaryGen(t, l, term, ["GREATER", "GREATER_EQUAL", "LESS", "LESS_EQUAL"])
const equality: ExprFn   = (t, l) => binaryGen(t, l, comparison, ["BANG_EQUAL", "EQUAL_EQUAL"])

const assignment: ExprFn = (tokens, location) => {
    const { node, next, error } = equality(tokens, location)

    if (match(tokens, next, ["EQUAL"])) {
        const { node: value, next: n2, error: e2 } = assignment(tokens, next + 1)
        // plain variable assignment: x = val
        if (node.type === "VARIABLE") {
            const varNode = node as { type: string; name: Token }
            return { node: Expr.Assign(varNode.name.lexeme, value), next: n2, error: error + e2 }
        }
        // index assignment: a[i] = val
        if (node.type === "INDEX") {
            const idxNode = node as { type: string; object: ASTNode; index: ASTNode }
            return { node: Expr.IndexAssign(idxNode.object, idxNode.index, value), next: n2, error: error + e2 }
        }
        return { node: Expr.Literal(null), next: n2, error: error + e2 + " INVALID ASSIGNMENT TARGET" }
    }
    return { node, next, error }
}

const expression: ExprFn = (tokens, location) => assignment(tokens, location)

/* ----- Statement parsing ----- */

type StmtResult = { node: ASTNode; next: number; error: string }

const consumeSemicolon = (tokens: Token[], location: number): { next: number; error: string } => {
    if (match(tokens, location, ["SEMICOLON"])) return { next: location + 1, error: "" }
    return { next: location, error: `[TOKEN ${location}] EXPECTED ';' AFTER STATEMENT` }
}

const parseBlock = (tokens: Token[], location: number): { nodes: ASTNode[]; next: number; error: string } => {
    if (!match(tokens, location, ["LEFT_BRACE"]))
        return { nodes: [], next: location, error: `[TOKEN ${location}] EXPECTED '{'` }
    let cur = location + 1
    const nodes: ASTNode[] = []
    let error = ""
    while (!isAtEnd(tokens, cur) && !match(tokens, cur, ["RIGHT_BRACE"])) {
        const { node, next, error: e } = parseStatement(tokens, cur)
        nodes.push(node)
        error += e
        if (next === cur) break
        cur = next
    }
    if (!match(tokens, cur, ["RIGHT_BRACE"]))
        return { nodes, next: cur, error: error + ` [TOKEN ${cur}] EXPECTED '}'` }
    return { nodes, next: cur + 1, error }
}

const parseStatement = (tokens: Token[], location: number): StmtResult => {
    // print statement
    if (match(tokens, location, ["PRINT"])) {
        const { node: expr, next, error } = expression(tokens, location + 1)
        const { next: n2, error: e2 } = consumeSemicolon(tokens, next)
        return { node: Stmt.Print(expr), next: n2, error: error + e2 }
    }

    // variable declaration
    if (match(tokens, location, ["LET", "CONST"])) {
        if (!match(tokens, location + 1, ["IDENTIFIER"]))
            return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location + 1}] EXPECTED IDENTIFIER AFTER 'let'/'const'` }
        const name = get(tokens, location + 1).lexeme
        let cur = location + 2
        let expr: ASTNode | null = null
        let error = ""
        if (match(tokens, cur, ["EQUAL"])) {
            const { node, next, error: e } = expression(tokens, cur + 1)
            expr = node
            cur = next
            error = e
        }
        const { next: n2, error: e2 } = consumeSemicolon(tokens, cur)
        return { node: Stmt.Var(name, expr), next: n2, error: error + e2 }
    }

    // function declaration: fun name(params) { body }
    if (match(tokens, location, ["FUN"])) {
        if (!match(tokens, location + 1, ["IDENTIFIER"]))
            return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location + 1}] EXPECTED FUNCTION NAME` }
        const name = get(tokens, location + 1).lexeme
        if (!match(tokens, location + 2, ["LEFT_PAREN"]))
            return { node: Expr.Literal(null), next: location + 2, error: `[TOKEN ${location + 2}] EXPECTED '(' AFTER FUNCTION NAME` }
        const params: string[] = []
        let cur = location + 3
        while (!isAtEnd(tokens, cur) && !match(tokens, cur, ["RIGHT_PAREN"])) {
            if (!match(tokens, cur, ["IDENTIFIER"]))
                break
            params.push(get(tokens, cur).lexeme)
            cur++
            if (match(tokens, cur, ["COMMA"])) cur++
        }
        if (!match(tokens, cur, ["RIGHT_PAREN"]))
            return { node: Expr.Literal(null), next: cur, error: `[TOKEN ${cur}] EXPECTED ')' AFTER PARAMS` }
        cur++
        const { nodes: body, next: afterBody, error } = parseBlock(tokens, cur)
        return { node: Stmt.Fun(name, params, body), next: afterBody, error }
    }

    // return statement
    if (match(tokens, location, ["RETURN"])) {
        if (match(tokens, location + 1, ["SEMICOLON"]))
            return { node: Stmt.Return(null), next: location + 2, error: "" }
        const { node: val, next, error } = expression(tokens, location + 1)
        const { next: n2, error: e2 } = consumeSemicolon(tokens, next)
        return { node: Stmt.Return(val), next: n2, error: error + e2 }
    }

    // if statement
    if (match(tokens, location, ["IF"])) {
        if (!match(tokens, location + 1, ["LEFT_PAREN"]))
            return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location + 1}] EXPECTED '(' AFTER 'if'` }
        const { node: cond, next: afterCond, error: e1 } = expression(tokens, location + 2)
        let cur = afterCond
        let error = e1
        if (!match(tokens, cur, ["RIGHT_PAREN"])) error += ` [TOKEN ${cur}] EXPECTED ')' AFTER IF CONDITION`
        else cur++
        const { nodes: thenNodes, next: afterThen, error: e2 } = parseBlock(tokens, cur)
        error += e2
        cur = afterThen
        let elseNodes: ASTNode[] | null = null
        if (match(tokens, cur, ["ELSE"])) {
            const { nodes, next, error: e3 } = parseBlock(tokens, cur + 1)
            elseNodes = nodes
            cur = next
            error += e3
        }
        return { node: Stmt.If(cond, thenNodes, elseNodes), next: cur, error }
    }

    // while statement
    if (match(tokens, location, ["WHILE"])) {
        if (!match(tokens, location + 1, ["LEFT_PAREN"]))
            return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location + 1}] EXPECTED '(' AFTER 'while'` }
        const { node: cond, next: afterCond, error: e1 } = expression(tokens, location + 2)
        let cur = afterCond
        let error = e1
        if (!match(tokens, cur, ["RIGHT_PAREN"])) error += ` [TOKEN ${cur}] EXPECTED ')' AFTER WHILE CONDITION`
        else cur++
        const { nodes: body, next: afterBody, error: e2 } = parseBlock(tokens, cur)
        error += e2
        return { node: Stmt.While(cond, body), next: afterBody, error }
    }

    // expression statement
    const { node, next, error } = expression(tokens, location)
    const { next: n2, error: e2 } = consumeSemicolon(tokens, next)
    return { node: Stmt.Expression(node), next: n2, error: error + e2 }
}

/* ----- Parser entry point ----- */

export const parse = (tokens: Token[]): { nodes: ASTNode[]; error: string } => {
    const sem = tokens.filter(t => !["NEWLINE", "SPACE"].includes(t.type))
    if (sem.length <= 1) return { nodes: [], error: "" }

    const nodes: ASTNode[] = []
    let cur = 0
    let error = ""

    while (!isAtEnd(sem, cur)) {
        const { node, next, error: e } = parseStatement(sem, cur)
        nodes.push(node)
        error += e
        if (next === cur) break
        cur = next
    }

    return { nodes, error }
}
