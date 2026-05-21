import { Environment } from "./environment"
import type { Value } from "./environment"
import type { ASTNode } from "../parser/generator"

const isTruthy = (v: Value): boolean => v !== null && v !== false

const stringify = (v: Value): string => {
    if (v === null) return "nil"
    return String(v)
}

const evaluate = (node: ASTNode, env: Environment): Value => {
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
            env.set(n.name as string, value)
            return value
        }

        default:
            throw new Error(`Cannot evaluate expression node type '${n.type}'.`)
    }
}

const executeBlock = (stmts: ASTNode[], env: Environment, output: string[]): void => {
    for (const stmt of stmts) {
        executeStmt(stmt, env, output)
    }
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
            env.define(n.name as string, val)
            break
        }

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

export const interpret = (stmts: ASTNode[]): { output: string[]; error: string | null } => {
    const output: string[] = []
    const env = new Environment()
    try {
        executeBlock(stmts, env, output)
        return { output, error: null }
    } catch (e) {
        return { output, error: (e as Error).message }
    }
}
