import { Environment } from "./environment"
import type { ASTNode } from "../parser/generator"

// ── Types ────────────────────────────────────────────────────────

type BobaArray = { kind: "array"; elements: unknown[] }
type BobaFn    = { kind: "fn"; name: string; params: string[]; body: ASTNode[]; closure: Environment }
type BobaValue = string | number | boolean | null | BobaArray | BobaFn

export type CallFrame = {
    name: string
    args: Record<string, string>
}

export type StepFrame = {
    nodeType: string
    label: string                    // human-readable description of what's happening
    output: string[]
    scope: Record<string, string>
    callStack: CallFrame[]
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
        if (v.kind === "array") return "[" + (v as BobaArray).elements.map(e => stringify(e as BobaValue)).join(", ") + "]"
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

type StepCtx = {
    output: string[]
    callStack: CallFrame[]
}

function* evalGen(node: ASTNode, env: Environment, ctx: StepCtx): Generator<StepFrame, BobaValue> {
    const n = node as Record<string, unknown>
    const snap = () => ({ output: [...ctx.output], scope: snapshotScope(env), callStack: [...ctx.callStack] })

    switch (n.type as string) {
        case "LITERAL":
            return n.expr as BobaValue

        case "GROUPING":
            return yield* evalGen(n.expr as ASTNode, env, ctx)

        case "UNARY": {
            yield { nodeType: "UNARY", label: `unary ${(n.opr as Token).lexeme}`, ...snap(), done: false, error: null }
            const right = yield* evalGen(n.right as ASTNode, env, ctx)
            if ((n.opr as Token).type === "MINUS") {
                if (typeof right !== "number") throw new Error("Operand must be a number.")
                return -right
            }
            return !isTruthy(right)
        }

        case "BINARY": {
            const op = (n.opr as Token).lexeme
            yield { nodeType: "BINARY", label: `binary ${op}`, ...snap(), done: false, error: null }
            const left = yield* evalGen(n.left as ASTNode, env, ctx)
            const right = yield* evalGen(n.right as ASTNode, env, ctx)
            const opType = (n.opr as Token).type
            switch (opType) {
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
            throw new Error(`Unknown operator '${opType}'.`)
        }

        case "VARIABLE": {
            const name = (n.name as Token).lexeme
            const val = env.get(name) as BobaValue
            return val
        }

        case "ASSIGN": {
            yield { nodeType: "ASSIGN", label: `assign ${n.name}`, ...snap(), done: false, error: null }
            const val = yield* evalGen(n.value as ASTNode, env, ctx)
            env.set(n.name as string, val)
            return val
        }

        case "ARRAY": {
            const elements: BobaValue[] = []
            for (const el of n.elements as ASTNode[]) {
                elements.push(yield* evalGen(el, env, ctx))
            }
            return { kind: "array", elements }
        }

        case "INDEX": {
            const obj = yield* evalGen(n.object as ASTNode, env, ctx)
            const idx = yield* evalGen(n.index as ASTNode, env, ctx)
            if (typeof obj === "object" && obj !== null && "kind" in obj && obj.kind === "array") {
                const i = Math.floor(idx as number)
                return (obj as BobaArray).elements[i] as BobaValue
            }
            if (typeof obj === "string") return obj[Math.floor(idx as number)]
            throw new Error("Only arrays and strings can be indexed.")
        }

        case "INDEX_ASSIGN": {
            const obj = yield* evalGen(n.object as ASTNode, env, ctx)
            const idx = yield* evalGen(n.index as ASTNode, env, ctx)
            const val = yield* evalGen(n.value as ASTNode, env, ctx)
            if (typeof obj === "object" && obj !== null && "kind" in obj && obj.kind === "array") {
                ;(obj as BobaArray).elements[Math.floor(idx as number)] = val
                return val
            }
            throw new Error("Only arrays support index assignment.")
        }

        case "CALL": {
            const calleeVal = yield* evalGen(n.callee as ASTNode, env, ctx)
            const callee = calleeVal as unknown as BobaFn
            if (!callee || callee.kind !== "fn") throw new Error(`Not a function.`)

            const argVals: BobaValue[] = []
            for (const a of n.args as ASTNode[]) {
                argVals.push(yield* evalGen(a, env, ctx))
            }

            if (argVals.length !== callee.params.length)
                throw new Error(`Expected ${callee.params.length} args but got ${argVals.length}.`)

            const argMap: Record<string, string> = {}
            ;(callee.params as string[]).forEach((p: string, i: number) => { argMap[p] = stringify(argVals[i]) })

            const frame: CallFrame = { name: callee.name, args: argMap }
            ctx.callStack.push(frame)

            yield { nodeType: "CALL", label: `call ${callee.name}(${(callee.params as string[]).map((p: string, i: number) => `${p}=${stringify(argVals[i])}`).join(", ")})`, ...snap(), done: false, error: null }

            const fnEnv = new Environment(callee.closure)
            ;(callee.params as string[]).forEach((p: string, i: number) => fnEnv.define(p, argVals[i]))

            let returnVal: BobaValue = null
            try {
                yield* stmtGenerator(callee.body, fnEnv, ctx)
            } catch (e) {
                if (e instanceof ReturnSignal) { returnVal = e.value }
                else { ctx.callStack.pop(); throw e }
            }

            ctx.callStack.pop()
            yield { nodeType: "RETURN", label: `return from ${callee.name} → ${stringify(returnVal)}`, ...snap(), done: false, error: null }
            return returnVal
        }

        default:
            throw new Error(`Cannot evaluate '${n.type}'.`)
    }
}

function* stmtGenerator(stmts: ASTNode[], env: Environment, ctx: StepCtx): Generator<StepFrame> {
    for (const stmt of stmts) {
        const n = stmt as Record<string, unknown>
        const snap = () => ({ output: [...ctx.output], scope: snapshotScope(env), callStack: [...ctx.callStack] })

        try {
            switch (n.type as string) {
                case "EXPRESSION": {
                    yield { nodeType: "EXPRESSION", label: "expression", ...snap(), done: false, error: null }
                    yield* evalGen(n.expr as ASTNode, env, ctx)
                    break
                }
                case "PRINT": {
                    yield { nodeType: "PRINT", label: "print", ...snap(), done: false, error: null }
                    const val = yield* evalGen(n.expr as ASTNode, env, ctx)
                    ctx.output.push(stringify(val))
                    break
                }
                case "VAR": {
                    yield { nodeType: "VAR", label: `let ${n.name}`, ...snap(), done: false, error: null }
                    const val = n.expr ? yield* evalGen(n.expr as ASTNode, env, ctx) : null
                    env.define(n.name as string, val)
                    break
                }
                case "FUN": {
                    yield { nodeType: "FUN", label: `fun ${n.name}`, ...snap(), done: false, error: null }
                    env.define(n.name as string, { kind: "fn", name: n.name, params: n.params, body: n.body, closure: env })
                    break
                }
                case "RETURN": {
                    yield { nodeType: "RETURN", label: "return", ...snap(), done: false, error: null }
                    throw new ReturnSignal(n.value ? (yield* evalGen(n.value as ASTNode, env, ctx)) : null)
                }
                case "IF": {
                    yield { nodeType: "IF", label: "if condition", ...snap(), done: false, error: null }
                    const cond = yield* evalGen(n.condition as ASTNode, env, ctx)
                    const branch = isTruthy(cond) ? n.then as ASTNode[] : (n.else as ASTNode[] | null)
                    if (branch) {
                        yield { nodeType: "IF", label: `if → ${isTruthy(cond) ? "then" : "else"}`, ...snap(), done: false, error: null }
                        yield* stmtGenerator(branch, new Environment(env), ctx)
                    }
                    break
                }
                case "WHILE": {
                    let guard = 0
                    while (true) {
                        yield { nodeType: "WHILE", label: "while condition", ...snap(), done: false, error: null }
                        const cond = yield* evalGen(n.condition as ASTNode, env, ctx)
                        if (!isTruthy(cond)) break
                        yield { nodeType: "WHILE", label: "while body", ...snap(), done: false, error: null }
                        yield* stmtGenerator(n.body as ASTNode[], new Environment(env), ctx)
                        if (++guard > 10000) throw new Error("Infinite loop detected (> 10000 iterations).")
                    }
                    break
                }
                case "BLOCK": {
                    yield* stmtGenerator(n.body as ASTNode[], new Environment(env), ctx)
                    break
                }
                default: {
                    yield { nodeType: n.type as string, label: n.type as string, ...snap(), done: false, error: null }
                    yield* evalGen(stmt, env, ctx)
                }
            }
        } catch (e) {
            if (e instanceof ReturnSignal) throw e
            yield { nodeType: n.type as string, label: (e as Error).message, ...snap(), done: true, error: (e as Error).message }
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
    const ctx: StepCtx = { output: [], callStack: [] }
    const env = new Environment()
    const gen = stmtGenerator(stmts, env, ctx)

    const initial: StepFrame = { nodeType: "", label: "start", output: [], scope: {}, callStack: [], done: false, error: null }
    let current: StepFrame = initial
    let isDone = false

    const step = (): StepFrame => {
        if (isDone) return current
        const result = gen.next()
        if (result.done) {
            isDone = true
            current = { ...current, output: [...ctx.output], scope: snapshotScope(env), callStack: [], done: true, error: null }
        } else {
            current = result.value
        }
        return current
    }

    return { step, get isDone() { return isDone }, get current() { return current } }
}
