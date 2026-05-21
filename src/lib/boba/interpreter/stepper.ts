import { Environment } from "./environment"
import type { ASTNode } from "../parser/generator"

// ── Types ────────────────────────────────────────────────────────

type BobaArray = { kind: "array"; elements: unknown[] }
type BobaFn    = { kind: "fn"; name: string; params: string[]; body: ASTNode[]; closure: Environment }
type BobaValue = string | number | boolean | null | BobaArray | BobaFn

export type StepFrame = {
    nodeType: string         // which AST node type is executing
    output: string[]         // accumulated output so far
    scope: Record<string, string>  // current scope snapshot (name → stringified value)
    done: boolean
    error: string | null
}

class ReturnSignal {
    constructor(public value: BobaValue) {}
}

// ── Helpers ──────────────────────────────────────────────────────

const isTruthy = (v: BobaValue): boolean => {
    if (v === null || v === false) return false
    if (typeof v === "object" && v !== null && "kind" in v) return true
    return v !== 0 && v !== ""
}

const stringify = (v: BobaValue): string => {
    if (v === null) return "nil"
    if (typeof v === "object" && v !== null && "kind" in v) {
        if (v.kind === "array") return "[" + (v as BobaArray).elements.map(stringify).join(", ") + "]"
        if (v.kind === "fn") return `<fun ${(v as BobaFn).name}>`
    }
    return String(v)
}

const snapshotScope = (env: Environment): Record<string, string> => {
    const result: Record<string, string> = {}
    let e: Environment | null = env
    while (e) {
        for (const [k, v] of e.values) {
            if (!(k in result)) result[k] = stringify(v as BobaValue)
        }
        e = e.parent
    }
    return result
}

// ── Generator interpreter ────────────────────────────────────────

function evaluate(node: ASTNode, env: Environment): BobaValue {
    const n = node as Record<string, unknown>
    switch (n.type as string) {
        case "LITERAL": return n.expr as BobaValue
        case "GROUPING": return evaluate(n.expr as ASTNode, env)
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
                    return stringify(left) + stringify(right)
                case "MINUS": return (left as number) - (right as number)
                case "STAR":  return (left as number) * (right as number)
                case "SLASH":
                    if (right === 0) throw new Error("Division by zero.")
                    return (left as number) / (right as number)
                case "GREATER":       return (left as number) > (right as number)
                case "GREATER_EQUAL": return (left as number) >= (right as number)
                case "LESS":          return (left as number) < (right as number)
                case "LESS_EQUAL":    return (left as number) <= (right as number)
                case "EQUAL_EQUAL":   return left === right
                case "BANG_EQUAL":    return left !== right
            }
            throw new Error(`Unknown operator '${op}'.`)
        }
        case "VARIABLE": return env.get((n.name as Token).lexeme) as BobaValue
        case "ASSIGN": {
            const val = evaluate(n.value as ASTNode, env)
            env.set(n.name as string, val)
            return val
        }
        case "ARRAY": return { kind: "array", elements: (n.elements as ASTNode[]).map(e => evaluate(e, env)) }
        case "INDEX": {
            const obj = evaluate(n.object as ASTNode, env)
            const idx = evaluate(n.index as ASTNode, env)
            if (typeof obj === "object" && obj !== null && "kind" in obj && obj.kind === "array") {
                const i = Math.floor(idx as number)
                return (obj as BobaArray).elements[i] as BobaValue
            }
            if (typeof obj === "string") return obj[Math.floor(idx as number)]
            throw new Error("Only arrays and strings can be indexed.")
        }
        case "INDEX_ASSIGN": {
            const obj = evaluate(n.object as ASTNode, env)
            const idx = evaluate(n.index as ASTNode, env)
            const val = evaluate(n.value as ASTNode, env)
            if (typeof obj === "object" && obj !== null && "kind" in obj && obj.kind === "array") {
                ;(obj as BobaArray).elements[Math.floor(idx as number)] = val
                return val
            }
            throw new Error("Only arrays support index assignment.")
        }
        case "CALL": {
            const callee = evaluate(n.callee as ASTNode, env) as BobaFn
            if (!callee || callee.kind !== "fn") throw new Error(`Not a function.`)
            const args = (n.args as ASTNode[]).map(a => evaluate(a, env))
            if (args.length !== callee.params.length)
                throw new Error(`Expected ${callee.params.length} args but got ${args.length}.`)
            const fnEnv = new Environment(callee.closure)
            callee.params.forEach((p, i) => fnEnv.define(p, args[i]))
            // inline execution — return value via ReturnSignal
            try {
                for (const stmt of callee.body) execStmtSync(stmt, fnEnv)
            } catch (e) {
                if (e instanceof ReturnSignal) return e.value
                throw e
            }
            return null
        }
        default:
            throw new Error(`Cannot evaluate '${n.type}'.`)
    }
}

function execStmtSync(node: ASTNode, env: Environment): void {
    const n = node as Record<string, unknown>
    switch (n.type as string) {
        case "EXPRESSION": evaluate(n.expr as ASTNode, env); break
        case "VAR": env.define(n.name as string, n.expr ? evaluate(n.expr as ASTNode, env) : null); break
        case "FUN": env.define(n.name as string, { kind: "fn", name: n.name, params: n.params, body: n.body, closure: env }); break
        case "RETURN": throw new ReturnSignal(n.value ? evaluate(n.value as ASTNode, env) : null)
        case "IF": {
            const cond = evaluate(n.condition as ASTNode, env)
            if (isTruthy(cond)) for (const s of n.then as ASTNode[]) execStmtSync(s, new Environment(env))
            else if (n.else) for (const s of n.else as ASTNode[]) execStmtSync(s, new Environment(env))
            break
        }
        case "WHILE": {
            while (isTruthy(evaluate(n.condition as ASTNode, env)))
                for (const s of n.body as ASTNode[]) execStmtSync(s, new Environment(env))
            break
        }
        case "BLOCK": for (const s of n.body as ASTNode[]) execStmtSync(s, new Environment(env)); break
        default: evaluate(node, env)
    }
}

function* stmtGenerator(stmts: ASTNode[], env: Environment, output: string[]): Generator<StepFrame> {
    for (const stmt of stmts) {
        const n = stmt as Record<string, unknown>
        yield { nodeType: n.type as string, output: [...output], scope: snapshotScope(env), done: false, error: null }

        try {
            switch (n.type as string) {
                case "EXPRESSION": evaluate(n.expr as ASTNode, env); break
                case "PRINT": {
                    const val = evaluate(n.expr as ASTNode, env)
                    output.push(stringify(val))
                    break
                }
                case "VAR":
                    env.define(n.name as string, n.expr ? evaluate(n.expr as ASTNode, env) : null)
                    break
                case "FUN":
                    env.define(n.name as string, { kind: "fn", name: n.name, params: n.params, body: n.body, closure: env })
                    break
                case "RETURN": throw new ReturnSignal(n.value ? evaluate(n.value as ASTNode, env) : null)
                case "IF": {
                    const cond = evaluate(n.condition as ASTNode, env)
                    const branch = isTruthy(cond) ? n.then as ASTNode[] : (n.else as ASTNode[] | null)
                    if (branch) yield* stmtGenerator(branch, new Environment(env), output)
                    break
                }
                case "WHILE": {
                    let guard = 0
                    while (isTruthy(evaluate(n.condition as ASTNode, env))) {
                        yield* stmtGenerator(n.body as ASTNode[], new Environment(env), output)
                        if (++guard > 10000) throw new Error("Infinite loop detected (> 10000 iterations).")
                    }
                    break
                }
                case "BLOCK":
                    yield* stmtGenerator(n.body as ASTNode[], new Environment(env), output)
                    break
                default:
                    evaluate(stmt, env)
            }
        } catch (e) {
            if (e instanceof ReturnSignal) throw e
            yield { nodeType: n.type as string, output: [...output], scope: snapshotScope(env), done: true, error: (e as Error).message }
            return
        }
    }
}

// ── Public API ───────────────────────────────────────────────────

export type Stepper = {
    step: () => StepFrame
    isDone: boolean
    current: StepFrame
}

export const createStepper = (stmts: ASTNode[]): Stepper => {
    const output: string[] = []
    const env = new Environment()
    const gen = stmtGenerator(stmts, env, output)

    const initial: StepFrame = { nodeType: "", output: [], scope: {}, done: false, error: null }
    let current: StepFrame = initial
    let isDone = false

    const step = (): StepFrame => {
        if (isDone) return current
        const result = gen.next()
        if (result.done) {
            isDone = true
            current = { ...current, output: [...output], scope: snapshotScope(env), done: true, error: null }
        } else {
            current = result.value
        }
        return current
    }

    return { step, get isDone() { return isDone }, get current() { return current } }
}
