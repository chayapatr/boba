import { Environment } from "./environment"
import type { Value } from "./environment"
import type { ASTNode } from "../parser/generator"

// ── Types ────────────────────────────────────────────────────────

type BobaArray = { kind: "array"; elements: Value[] }
type BobaFn    = { kind: "fn"; name: string; params: string[]; body: ASTNode[]; closure: Environment }
type BobaValue = Value | BobaArray | BobaFn

class ReturnSignal {
    constructor(public value: BobaValue) {}
}

// ── Helpers ──────────────────────────────────────────────────────

const isTruthy = (v: BobaValue): boolean => {
    if (v === null || v === false) return false
    if (typeof v === "object" && "kind" in v) return true
    return v !== 0 && v !== ""
}

const stringify = (v: BobaValue): string => {
    if (v === null) return "nil"
    if (typeof v === "object" && "kind" in v) {
        if (v.kind === "array") return "[" + v.elements.map(stringify).join(", ") + "]"
        if (v.kind === "fn") return `<fun ${v.name}>`
    }
    return String(v)
}

// ── Evaluate ─────────────────────────────────────────────────────

// Thread output through evaluation without passing it everywhere
let _currentOutput: string[] = []

const evaluate = (node: ASTNode, env: Environment): BobaValue => {
    const n = node as Record<string, unknown>

    switch (n.type as string) {
        case "LITERAL":
            return n.expr as Value

        case "GROUPING":
            return evaluate(n.expr as ASTNode, env)

        case "UNARY": {
            const right = evaluate(n.right as ASTNode, env)
            if ((n.opr as Token).type === "MINUS") {
                if (typeof right !== "number") throw new Error("Operand must be a number.")
                return -right
            }
            return !isTruthy(right)
        }

        case "BINARY": {
            const left = evaluate(n.left as ASTNode, env)
            const right = evaluate(n.right as ASTNode, env)
            const op = (n.opr as Token).type
            switch (op) {
                case "PLUS":
                    if (typeof left === "number" && typeof right === "number") return left + right
                    if (typeof left === "string" || typeof right === "string") return stringify(left) + stringify(right)
                    throw new Error("Operands must be two numbers or at least one string.")
                case "MINUS":
                    if (typeof left !== "number" || typeof right !== "number") throw new Error("Operands must be numbers.")
                    return left - right
                case "STAR":
                    if (typeof left !== "number" || typeof right !== "number") throw new Error("Operands must be numbers.")
                    return left * right
                case "SLASH":
                    if (typeof left !== "number" || typeof right !== "number") throw new Error("Operands must be numbers.")
                    if (right === 0) throw new Error("Division by zero.")
                    return left / right
                case "GREATER":         return (left as number) > (right as number)
                case "GREATER_EQUAL":   return (left as number) >= (right as number)
                case "LESS":            return (left as number) < (right as number)
                case "LESS_EQUAL":      return (left as number) <= (right as number)
                case "EQUAL_EQUAL":     return left === right
                case "BANG_EQUAL":      return left !== right
            }
            throw new Error(`Unknown operator '${op}'.`)
        }

        case "VARIABLE":
            return env.get((n.name as Token).lexeme)

        case "ASSIGN": {
            const value = evaluate(n.value as ASTNode, env)
            env.set(n.name as string, value as Value)
            return value
        }

        case "ARRAY": {
            const elements = (n.elements as ASTNode[]).map(e => evaluate(e, env))
            return { kind: "array", elements }
        }

        case "INDEX": {
            const obj = evaluate(n.object as ASTNode, env)
            const idx = evaluate(n.index as ASTNode, env)
            if (typeof obj === "object" && obj !== null && "kind" in obj && obj.kind === "array") {
                if (typeof idx !== "number") throw new Error("Array index must be a number.")
                const i = Math.floor(idx)
                if (i < 0 || i >= obj.elements.length) throw new Error(`Index ${i} out of bounds (length ${obj.elements.length}).`)
                return obj.elements[i]
            }
            if (typeof obj === "string") {
                if (typeof idx !== "number") throw new Error("String index must be a number.")
                const i = Math.floor(idx)
                if (i < 0 || i >= obj.length) throw new Error(`Index ${i} out of bounds.`)
                return obj[i]
            }
            throw new Error("Only arrays and strings can be indexed.")
        }

        case "INDEX_ASSIGN": {
            const obj = evaluate(n.object as ASTNode, env)
            const idx = evaluate(n.index as ASTNode, env)
            const val = evaluate(n.value as ASTNode, env)
            if (typeof obj === "object" && obj !== null && "kind" in obj && obj.kind === "array") {
                if (typeof idx !== "number") throw new Error("Array index must be a number.")
                const i = Math.floor(idx)
                if (i < 0 || i >= obj.elements.length) throw new Error(`Index ${i} out of bounds.`)
                obj.elements[i] = val
                return val
            }
            throw new Error("Only arrays support index assignment.")
        }

        case "CALL": {
            const callee = evaluate(n.callee as ASTNode, env)
            const args = (n.args as ASTNode[]).map(a => evaluate(a, env))
            if (typeof callee !== "object" || callee === null || !("kind" in callee) || callee.kind !== "fn")
                throw new Error(`'${stringify(callee)}' is not a function.`)
            if (args.length !== callee.params.length)
                throw new Error(`Expected ${callee.params.length} args but got ${args.length}.`)
            const fnEnv = new Environment(callee.closure)
            callee.params.forEach((p, i) => fnEnv.define(p, args[i] as Value))
            try {
                executeBlock(callee.body, fnEnv, _currentOutput)
            } catch (e) {
                if (e instanceof ReturnSignal) return e.value
                throw e
            }
            return null
        }

        default:
            throw new Error(`Cannot evaluate expression node type '${n.type}'.`)
    }
}

// ── Execute ──────────────────────────────────────────────────────

const executeBlock = (stmts: ASTNode[], env: Environment, output: string[]): void => {
    for (const stmt of stmts) executeStmt(stmt, env, output)
}

const executeStmt = (node: ASTNode, env: Environment, output: string[]): void => {
    const n = node as Record<string, unknown>

    switch (n.type as string) {
        case "EXPRESSION":
            evaluate(n.expr as ASTNode, env)
            break

        case "PRINT": {
            const val = evaluate(n.expr as ASTNode, env)
            output.push(stringify(val))
            break
        }

        case "VAR": {
            const val = n.expr ? evaluate(n.expr as ASTNode, env) : null
            env.define(n.name as string, val as Value)
            break
        }

        case "FUN": {
            const fn: BobaFn = {
                kind: "fn",
                name: n.name as string,
                params: n.params as string[],
                body: n.body as ASTNode[],
                closure: env
            }
            env.define(n.name as string, fn as unknown as Value)
            break
        }

        case "RETURN":
            throw new ReturnSignal(n.value ? evaluate(n.value as ASTNode, env) : null)

        case "IF": {
            const cond = evaluate(n.condition as ASTNode, env)
            if (isTruthy(cond)) {
                executeBlock(n.then as ASTNode[], new Environment(env), output)
            } else if (n.else) {
                executeBlock(n.else as ASTNode[], new Environment(env), output)
            }
            break
        }

        case "WHILE": {
            while (isTruthy(evaluate(n.condition as ASTNode, env))) {
                executeBlock(n.body as ASTNode[], new Environment(env), output)
            }
            break
        }

        case "BLOCK":
            executeBlock(n.body as ASTNode[], new Environment(env), output)
            break

        default:
            evaluate(node, env)
    }
}

// ── Public API ───────────────────────────────────────────────────

export const interpret = (stmts: ASTNode[]): { output: string[]; error: string | null } => {
    _currentOutput = []
    const env = new Environment()
    try {
        executeBlock(stmts, env, _currentOutput)
        return { output: _currentOutput, error: null }
    } catch (e) {
        if (e instanceof ReturnSignal) return { output: _currentOutput, error: "Return outside of function." }
        return { output: _currentOutput, error: (e as Error).message }
    }
}
