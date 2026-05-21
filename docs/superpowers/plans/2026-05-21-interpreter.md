# Boba Interpreter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Boba toy language into a working tree-walk interpreter with print, variables, if, and while — plus a third output panel in the UI.

**Architecture:** Fix two existing bugs (SLASH token, TokenTypeString typo), extend the parser from single-expression to multi-statement, add an Environment scope chain, write a recursive tree-walk interpreter, extract the highlighter into its own file, and wire a third output panel into the UI.

**Tech Stack:** TypeScript, SvelteKit, Tailwind CSS. No new dependencies.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/global.d.ts` | Modify | Fix `TokenTypeString` → `TokenTypeStrings` typo |
| `src/lib/boba/scanner.ts` | Modify | Add `"/"` → `SLASH` token |
| `src/lib/boba/parser/generator.ts` | Modify | Add `IfStmt`, `WhileStmt`, `BlockStmt`, `AssignExpr` node types |
| `src/lib/boba/parser/index.ts` | Rewrite | Full statement loop: print, var, if, while, block, assignment |
| `src/lib/boba/interpreter/environment.ts` | Create | `Environment` class with scope chain |
| `src/lib/boba/interpreter/index.ts` | Rewrite | Recursive tree-walk evaluator |
| `src/lib/boba/runner.ts` | Modify | Call `interpret()`, return `interpreted` in result |
| `src/lib/highlighter.ts` | Create | Extract `beautify`/`parseToken`/`types`/`generate` from `index.ts` |
| `src/lib/index.ts` | Modify | Thin re-export; import from `highlighter.ts` |
| `src/routes/+page.svelte` | Modify | Third output panel; extend `ASTtoString` for new node types |

---

### Task 1: Fix `TokenTypeString` typo in `global.d.ts`

**Files:**
- Modify: `src/global.d.ts:27`

- [ ] **Step 1: Fix the typo**

In `src/global.d.ts`, line 27, change:
```ts
// BEFORE
interface Token {
    type: TokenTypeString
    lexeme: string
    literal: string | number | undefined
    line: number
}
```
to:
```ts
// AFTER
interface Token {
    type: TokenTypeStrings
    lexeme: string
    literal: string | number | undefined
    line: number
}
```

- [ ] **Step 2: Verify the project still type-checks**

```bash
cd /Users/chayapatr/Craft/pub/boba && npx tsc --noEmit
```
Expected: no errors (or same errors as before, none related to `TokenTypeString`).

- [ ] **Step 3: Commit**

```bash
git add src/global.d.ts
git commit -m "fix: TokenTypeString typo → TokenTypeStrings"
```

---

### Task 2: Add SLASH token to scanner

**Files:**
- Modify: `src/lib/boba/scanner.ts:84-97`

- [ ] **Step 1: Add `/` to `scanSingleCharSymbol`**

In `src/lib/boba/scanner.ts`, inside `scanSingleCharSymbol`, the `chars` object currently ends with `"*": "STAR"`. Add `"/"`:

```ts
const chars: {
    [key: string]: TokenTypeStrings
} = {
    "(": "LEFT_PAREN",
    ")": "RIGHT_PAREN",
    "{": "LEFT_BRACE",
    "}": "RIGHT_BRACE",
    ",": "COMMA",
    ".": "DOT",
    "-": "MINUS",
    "+": "PLUS",
    ";": "SEMICOLON",
    "*": "STAR",
    "/": "SLASH",
    "\n": "NEWLINE"
}
```

- [ ] **Step 2: Verify division tokenizes**

Start the dev server and type `10 / 2` in the editor. The token table should show `SLASH` token with lexeme `/`. Or run:
```bash
cd /Users/chayapatr/Craft/pub/boba && npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/boba/scanner.ts
git commit -m "fix: add SLASH token for division operator"
```

---

### Task 3: Extend AST node types in `generator.ts`

**Files:**
- Modify: `src/lib/boba/parser/generator.ts`

- [ ] **Step 1: Add new node interfaces and constructors**

Replace the entire content of `src/lib/boba/parser/generator.ts` with:

```ts
/* Types */

type Opr = Token

type Expr = {
    type: string
}

interface BinaryExpr extends Expr {
    left: ASTNode,
    opr: Opr,
    right: ASTNode
}

interface GroupingExpr extends Expr {
    expr: ASTNode
}

interface LiteralExpr extends Expr {
    expr: string | number | boolean
}

interface UnaryExpr extends Expr {
    opr: Opr,
    right: ASTNode
}

interface VariableExpr extends Expr {
    name: Token
}

interface AssignExpr extends Expr {
    name: string
    value: ASTNode
}

interface Stmt {
    type: string
    expr: ASTNode
}

interface VarStmt {
    type: string
    name: string
    expr: ASTNode | null
}

interface IfStmt {
    type: "IF"
    condition: ASTNode
    then: ASTNode[]
    else: ASTNode[] | null
}

interface WhileStmt {
    type: "WHILE"
    condition: ASTNode
    body: ASTNode[]
}

interface BlockStmt {
    type: "BLOCK"
    body: ASTNode[]
}

export type ASTNode =
    | Expr | BinaryExpr | GroupingExpr | UnaryExpr
    | VariableExpr | AssignExpr
    | Stmt | VarStmt | IfStmt | WhileStmt | BlockStmt

/* AST Node Generator Functions */

const Binary = (left: Expr, opr: Opr, right: Expr): BinaryExpr =>
    ({ type: "BINARY", left, opr, right })

const Grouping = (expr: Expr): GroupingExpr =>
    ({ type: "GROUPING", expr })

const Literal = (expr: string | number | boolean | null): LiteralExpr => {
    if (expr == null) return { type: "LITERAL", expr: "nil" }
    return { type: "LITERAL", expr }
}

const Unary = (opr: Opr, right: Expr): UnaryExpr =>
    ({ type: "UNARY", opr, right })

const Variable = (name: Token): VariableExpr =>
    ({ type: "VARIABLE", name })

const Assign = (name: string, value: ASTNode): AssignExpr =>
    ({ type: "ASSIGN", name, value })

const Print = (expr: ASTNode): Stmt =>
    ({ type: "PRINT", expr })

const Expression = (expr: ASTNode): Stmt =>
    ({ type: "EXPRESSION", expr })

const Var = (name: string, expr: ASTNode | null): VarStmt =>
    ({ type: "VAR", name, expr })

const If = (condition: ASTNode, then: ASTNode[], elseBody: ASTNode[] | null): IfStmt =>
    ({ type: "IF", condition, then, else: elseBody })

const While = (condition: ASTNode, body: ASTNode[]): WhileStmt =>
    ({ type: "WHILE", condition, body })

const Block = (body: ASTNode[]): BlockStmt =>
    ({ type: "BLOCK", body })

export const Stmt = { Print, Expression, Var, If, While, Block }
export const Expr = { Binary, Grouping, Literal, Unary, Variable, Assign }
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/chayapatr/Craft/pub/boba && npx tsc --noEmit
```
Expected: errors only in `parser/index.ts` (return type mismatch — will be fixed next task).

- [ ] **Step 3: Commit**

```bash
git add src/lib/boba/parser/generator.ts
git commit -m "feat: extend AST node types for statements and assignment"
```

---

### Task 4: Rewrite parser with full statement loop

**Files:**
- Modify: `src/lib/boba/parser/index.ts`

- [ ] **Step 1: Replace the parser**

Replace the entire content of `src/lib/boba/parser/index.ts` with:

```ts
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

    if (match(tokens, location, ["IDENTIFIER"])) {
        return { node: Expr.Variable(get(tokens, location)), next: location + 1, error: "" }
    }

    if (match(tokens, location, ["LEFT_PAREN"])) {
        const { node: expr, next, error } = expression(tokens, location + 1)
        if (match(tokens, next, ["RIGHT_PAREN"]))
            return { node: Expr.Grouping(expr), next: next + 1, error }
        return { node: Expr.Literal(null), next: location + 1, error: error || `[TOKEN ${location}] PARENTHESIS NOT CLOSED` }
    }

    if (match(tokens, location, ["RIGHT_PAREN"]))
        return { node: Expr.Literal(null), next: location, error: `[TOKEN ${location}] UNEXPECTED RIGHT PAREN` }

    if (match(tokens, location, ["EOF"]))
        return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location}] UNEXPECTED EOF` }

    return { node: Expr.Literal(null), next: location + 1, error: `[TOKEN ${location}] UNEXPECTED TOKEN '${tokens[location].lexeme}'` }
}

const unary: ExprFn = (tokens, location) => {
    if (match(tokens, location, ["BANG", "MINUS"])) {
        const opr = get(tokens, location)
        const { node: right, next, error } = unary(tokens, location + 1)
        return { node: Expr.Unary(opr, right), next, error }
    }
    return primary(tokens, location)
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
        if (node.type === "VARIABLE") {
            const varNode = node as { type: string; name: Token }
            return { node: Expr.Assign(varNode.name.lexeme, value), next: n2, error: error + e2 }
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
        if (next === cur) break   // safety: no progress → stop
        cur = next
    }

    return { nodes, error }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/chayapatr/Craft/pub/boba && npx tsc --noEmit
```
Expected: errors only in `runner.ts` and `+page.svelte` (they reference the old return shape — fixed in later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/lib/boba/parser/index.ts
git commit -m "feat: rewrite parser with full statement loop (print, var, if, while, assignment)"
```

---

### Task 5: Create `Environment` class

**Files:**
- Create: `src/lib/boba/interpreter/environment.ts`

- [ ] **Step 1: Write the file**

Create `src/lib/boba/interpreter/environment.ts`:

```ts
export type Value = number | string | boolean | null

export class Environment {
    private values = new Map<string, Value>()

    constructor(private parent: Environment | null = null) {}

    define(name: string, value: Value): void {
        this.values.set(name, value)
    }

    get(name: string): Value {
        if (this.values.has(name)) return this.values.get(name)!
        if (this.parent) return this.parent.get(name)
        throw new Error(`Undefined variable '${name}'.`)
    }

    set(name: string, value: Value): void {
        if (this.values.has(name)) { this.values.set(name, value); return }
        if (this.parent) { this.parent.set(name, value); return }
        throw new Error(`Undefined variable '${name}'.`)
    }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/chayapatr/Craft/pub/boba && npx tsc --noEmit
```
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/boba/interpreter/environment.ts
git commit -m "feat: add Environment class with scope chain"
```

---

### Task 6: Implement the tree-walk interpreter

**Files:**
- Modify: `src/lib/boba/interpreter/index.ts`

- [ ] **Step 1: Replace the stub**

Replace the entire content of `src/lib/boba/interpreter/index.ts` with:

```ts
import { Environment } from "./environment"
import type { Value } from "./environment"
import type { ASTNode } from "../parser/generator"

const isTruthy = (v: Value): boolean => v !== null && v !== false

const stringify = (v: Value): string => {
    if (v === null) return "nil"
    if (typeof v === "boolean") return String(v)
    if (typeof v === "number") return String(v)
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

        case "GROUPING":
            return evaluate(n.expr as ASTNode, env)

        default:
            throw new Error(`Cannot evaluate node type '${n.type}'.`)
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
            const child = new Environment(env)
            if (isTruthy(cond)) {
                executeBlock(n.then as ASTNode[], child, output)
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
            evaluate(node, env, )
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
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/chayapatr/Craft/pub/boba && npx tsc --noEmit
```
Expected: no errors in interpreter files.

- [ ] **Step 3: Commit**

```bash
git add src/lib/boba/interpreter/index.ts
git commit -m "feat: implement tree-walk interpreter"
```

---

### Task 7: Update runner to wire interpreter

**Files:**
- Modify: `src/lib/boba/runner.ts`

- [ ] **Step 1: Rewrite runner**

Replace the entire content of `src/lib/boba/runner.ts` with:

```ts
import { scan } from "./scanner"
import { parse } from "./parser"
import { interpret } from "./interpreter"

export const run = (source: string) => {
    const scanned = scan(source)
    const parsed = scanned.success
        ? parse(scanned.tokens)
        : { nodes: [], error: "" }
    const interpreted = parsed.error
        ? { output: [], error: null }
        : interpret(parsed.nodes)
    return { scanned, parsed, interpreted }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/chayapatr/Craft/pub/boba && npx tsc --noEmit
```
Expected: errors only in `index.ts` (not yet updated).

- [ ] **Step 3: Commit**

```bash
git add src/lib/boba/runner.ts
git commit -m "feat: wire interpreter into runner pipeline"
```

---

### Task 8: Extract highlighter into `highlighter.ts`

**Files:**
- Create: `src/lib/highlighter.ts`
- Modify: `src/lib/index.ts`

- [ ] **Step 1: Create `src/lib/highlighter.ts`**

```ts
const types = {
    single: ['COMMA', 'DOT', 'MINUS', 'PLUS', 'SEMICOLON', 'SLASH', 'STAR', 'BANG', 'EQUAL', 'GREATER', 'LESS'],
    cover: ['LEFT_PAREN', 'RIGHT_PAREN', 'LEFT_BRACE', 'RIGHT_BRACE'],
    comparison: ['BANG_EQUAL', 'EQUAL_EQUAL', 'GREATER_EQUAL', 'LESS_EQUAL'],
    literals: ['IDENTIFIER', 'STRING', 'NUMBER'],
    keywords: ['AND', 'CLASS', 'ELSE', 'FALSE', 'FUN', 'FOR', 'IF', 'NIL', 'OR', 'PRINT', 'RETURN', 'SUPER', 'THIS', 'TRUE', 'LET', 'CONST', 'WHILE']
}

const generate = (color: "blue" | "red" | "purple" | "green" | "orange" | "gray" | "lightgray", text: string) => {
    const tw = {
        blue: 'text-blue-500',
        red: 'text-red-600',
        purple: 'text-purple-500',
        green: 'text-lime-600',
        orange: 'text-amber-600',
        gray: 'text-neutral-500',
        lightgray: 'text-neutral-300'
    }
    return `<span class="${tw[color]}">${text}</span>`
}

const parseToken = (token: Token) => {
    const { type, lexeme } = token
    if (["TRUE", "FALSE", "IDENTIFIER", "NUMBER"].includes(type)) return generate("blue", lexeme)
    if (types.cover.includes(type)) return generate("gray", lexeme)
    if (type === "PRINT") return generate("orange", lexeme)
    if (types.single.includes(type) || types.comparison.includes(type) || types.keywords.includes(type))
        return generate("red", lexeme)
    if (type === "STRING")
        return `<span class="text-purple-500">${lexeme.split("\n").join(`</span>%break%<span class="text-purple-500">`)}</span>`
    if (type === "NEWLINE") return `<br/>`
    if (type === "SPACE") return generate("lightgray", '⋅'.repeat(lexeme.length))
    return generate("blue", lexeme)
}

export const beautify = (tokens: Token[]): string[] =>
    tokens.map(parseToken).join('').split("<br/>")
```

- [ ] **Step 2: Update `src/lib/index.ts`**

Replace the entire content of `src/lib/index.ts` with:

```ts
import { run } from "./boba/runner"
export { beautify } from "./highlighter"

export const BOBA = (source: string) => run(source)
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/chayapatr/Craft/pub/boba && npx tsc --noEmit
```
Expected: no errors (or only `+page.svelte` shape mismatch — fixed next).

- [ ] **Step 4: Commit**

```bash
git add src/lib/highlighter.ts src/lib/index.ts
git commit -m "refactor: extract highlighter into highlighter.ts, thin index.ts"
```

---

### Task 9: Update UI — third output panel + extended AST renderer

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Replace `+page.svelte`**

Replace the entire content of `src/routes/+page.svelte` with:

```svelte
<script lang="ts">
	// @ts-nocheck
	import { BOBA } from '$lib';
	import type { ASTNode } from '$lib/boba/parser/generator';
	import Editor from '$lib/components/Editor.svelte';
	import { source } from '$lib/store';

	$: result = BOBA($source);

	const ASTtoString = (nodes: ASTNode[]): string => {
		if (!nodes || nodes.length === 0) return '';

		const dfs = (node: ASTNode, prefix: string): string => {
			const n = node as Record<string, unknown>;
			switch (n.type as string) {
				case 'LITERAL':
					return `<br/>${prefix}⊢ VALUE: ${n.expr}`;
				case 'BINARY':
					return `<br/>${prefix}⊢ BIN (${(n.opr as Token).lexeme})${dfs(n.left as ASTNode, prefix + '&nbsp;&nbsp;')}${dfs(n.right as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'GROUPING':
					return `<br/>${prefix}⊢ [GROUP]${dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'UNARY':
					return `<br/>${prefix}⊢ UNARY (${(n.opr as Token).lexeme})${dfs(n.right as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'VARIABLE':
					return `<br/>${prefix}⊢ VAR: ${(n.name as Token).lexeme}`;
				case 'ASSIGN':
					return `<br/>${prefix}⊢ ASSIGN (${n.name})${dfs(n.value as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'EXPRESSION':
					return `<br/>${prefix}⊢ EXPR${dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'PRINT':
					return `<br/>${prefix}⊢ PRINT${dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'VAR':
					return `<br/>${prefix}⊢ VAR DECL: ${n.name}${n.expr ? dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;') : ''}`;
				case 'IF':
					return (
						`<br/>${prefix}⊢ IF${dfs({ type: 'GROUPING', expr: n.condition } as ASTNode, prefix + '&nbsp;&nbsp;')}` +
						`<br/>${prefix}&nbsp;&nbsp;THEN: ${(n.then as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;&nbsp;&nbsp;')).join('')}` +
						(n.else
							? `<br/>${prefix}&nbsp;&nbsp;ELSE: ${(n.else as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;&nbsp;&nbsp;')).join('')}`
							: '')
					);
				case 'WHILE':
					return (
						`<br/>${prefix}⊢ WHILE${dfs({ type: 'GROUPING', expr: n.condition } as ASTNode, prefix + '&nbsp;&nbsp;')}` +
						`<br/>${prefix}&nbsp;&nbsp;BODY: ${(n.body as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;&nbsp;&nbsp;')).join('')}`
					);
				case 'BLOCK':
					return `<br/>${prefix}⊢ BLOCK${(n.body as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;')).join('')}`;
				default:
					return `<br/>${prefix}⊢ ${n.type}`;
			}
		};

		return '<span class="font-semibold">PROGRAM</span>' + nodes.map((n) => dfs(n, '')).join('');
	};
</script>

<div class="grid h-[100svh] gap-3 p-3 font-mono md:grid-cols-2 md:gap-4 md:p-4">
	<div class="h-[calc(50svh-0.75rem)] md:h-[calc(100svh-2rem)]">
		<Editor {result} />
	</div>

	<div
		class="flex h-[calc(50svh-1.5rem)] flex-col gap-3 text-xs md:h-[calc(100vh-2rem)] md:gap-4 md:text-sm"
	>
		<!-- TOKENS -->
		<ul class="flex flex-col overflow-y-scroll rounded-md border bg-gray-50 p-4" style="height: 30%">
			<div class="mb-1 font-semibold">
				<span class={result.scanned.success ? 'text-emerald-600' : 'text-red-600'}>
					{result.scanned.success ? '[SCANNING SUCCESS]' : `[ERROR: ${result.scanned.msg}]`}
				</span>
			</div>
			<li class="mb-1 grid grid-cols-4 gap-3 font-semibold">
				<div class="text-neutral-800">TYPE</div>
				<div>LEXEME</div>
				<div>LITERAL</div>
				<div>LINE</div>
			</li>
			<div class="mb-1 w-full border-t border-neutral-400"></div>
			{#each result.scanned.tokens.filter((t) => !['NEWLINE', 'SPACE'].includes(t.type)) as token}
				<li class="grid grid-cols-4 gap-3">
					<div class="text-neutral-800">{token.type}</div>
					<div class="w-full overflow-x-clip">{token.lexeme}</div>
					<div class={`${token.literal ?? 'text-neutral-400'}`}>{token.literal}</div>
					<div>{token.line}</div>
				</li>
			{/each}
		</ul>

		<!-- AST -->
		<div class="flex flex-col overflow-scroll rounded-md border bg-gray-50 p-4" style="height: 35%">
			<div class="mb-1 font-semibold">
				<span class={!result.parsed.error ? 'text-emerald-600' : 'text-red-600'}>
					{!result.parsed.error
						? '[PARSING SUCCESS]'
						: `[ERROR: ${result.parsed.error.split(',').at(0)}]`}
				</span>
			</div>
			<div class="w-max text-nowrap">
				{#if result.scanned.success && !result.parsed.error}
					{@html ASTtoString(result.parsed.nodes)}
				{/if}
			</div>
		</div>

		<!-- OUTPUT -->
		<div class="flex flex-col overflow-scroll rounded-md border bg-gray-50 p-4" style="height: 35%">
			<div class="mb-1 font-semibold">
				<span
					class={result.interpreted.error
						? 'text-red-600'
						: 'text-emerald-600'}
				>
					{result.interpreted.error
						? `[RUNTIME ERROR: ${result.interpreted.error}]`
						: '[OUTPUT]'}
				</span>
			</div>
			{#if result.interpreted.output.length === 0 && !result.interpreted.error}
				<div class="text-neutral-400">[no output]</div>
			{:else}
				{#each result.interpreted.output as line}
					<div>{line}</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
```

- [ ] **Step 2: Run the dev server and verify manually**

```bash
cd /Users/chayapatr/Craft/pub/boba && npm run dev
```

Open the browser and test these programs:

**Arithmetic:**
```
print 1 + 2 * 3;
```
Expected output: `7`

**Variables:**
```
let x = 10;
let y = 20;
print x + y;
```
Expected output: `30`

**If/else:**
```
let x = 5;
if (x > 3) {
  print "big";
} else {
  print "small";
}
```
Expected output: `big`

**While loop:**
```
let i = 0;
while (i < 3) {
  print i;
  i = i + 1;
}
```
Expected output: `0`, `1`, `2` (one per line)

**Division:**
```
print 10 / 2;
```
Expected output: `5`

**Runtime error:**
```
print x;
```
Expected: red `[RUNTIME ERROR: Undefined variable 'x'.]`

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add output panel and extend AST renderer for all statement types"
```

---

### Task 10: Final type-check and smoke test

- [ ] **Step 1: Full type-check**

```bash
cd /Users/chayapatr/Craft/pub/boba && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 2: Confirm dev server runs cleanly**

```bash
npm run dev
```
No console errors in the terminal or browser.

- [ ] **Step 3: Final commit if any loose ends**

```bash
git add -A
git status
# Only commit if there are actual changes
```
