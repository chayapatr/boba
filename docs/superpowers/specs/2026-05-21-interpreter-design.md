# Boba Interpreter — Design Spec
_2026-05-21_

## Goal

Complete the Boba toy language into a working tree-walk interpreter with a visualizer. The language is simple but Turing-complete: arithmetic, strings, booleans, print, variables, if, and while.

---

## Language

```
program     → statement* EOF
statement   → printStmt | varDecl | ifStmt | whileStmt | exprStmt
printStmt   → "print" expression ";"
varDecl     → ("let" | "const") IDENTIFIER ("=" expression)? ";"
ifStmt      → "if" "(" expression ")" block ("else" block)?
whileStmt   → "while" "(" expression ")" block
block       → "{" statement* "}"
exprStmt    → expression ";"
expression  → assignment
assignment  → IDENTIFIER "=" assignment | equality
equality    → comparison ( ( "!=" | "==" ) comparison )*
comparison  → term ( ( ">" | ">=" | "<" | "<=" ) term )*
term        → factor ( ( "+" | "-" ) factor )*
factor      → unary ( ( "*" | "/" ) unary )*
unary       → ( "!" | "-" ) unary | primary
primary     → NUMBER | STRING | "true" | "false" | "nil"
            | "(" expression ")" | IDENTIFIER
```

**Value types:** `number | string | boolean | null`

**Truthiness:** `false` and `null` are falsy; everything else is truthy.

**`+` operator:** numeric addition if both operands are numbers; string concatenation if either is a string; runtime error otherwise.

---

## File Structure

```
src/lib/
├── boba/
│   ├── scanner.ts              existing — add SLASH ("/") token
│   ├── parser/
│   │   ├── generator.ts        extend with new AST node types
│   │   └── index.ts            extend parser with statement loop
│   ├── interpreter/
│   │   ├── environment.ts      NEW — Environment class
│   │   └── index.ts            replace stub — recursive evaluator
│   └── runner.ts               extend to call interpret(), return output
├── highlighter.ts              NEW — extract beautify/parseToken from index.ts
├── store.ts                    unchanged
└── index.ts                    thin re-export of BOBA + beautify

src/routes/
└── +page.svelte                add third output panel, extend AST renderer
```

---

## Bugs Fixed

| Location | Bug | Fix |
|---|---|---|
| `global.d.ts:27` | `TokenTypeString` (missing `s`) | rename to `TokenTypeStrings` |
| `scanner.ts` | `/` not recognized → division broken | add `"/"` → `"SLASH"` to `scanSingleCharSymbol` |
| `parser/index.ts` | single-expression only, multi-statement commented out | implement statement loop |

---

## AST Node Types

Existing nodes (`generator.ts`) keep their shape. New nodes added:

```ts
interface IfStmt     { type: "IF";    condition: ASTNode; then: ASTNode[]; else: ASTNode[] | null }
interface WhileStmt  { type: "WHILE"; condition: ASTNode; body: ASTNode[] }
interface BlockStmt  { type: "BLOCK"; body: ASTNode[] }
interface AssignExpr { type: "ASSIGN"; name: string; value: ASTNode }
```

`VarStmt` and `PrintStmt` already defined in `generator.ts` — just unused. They stay as-is.

`parse()` return type changes from `{ node: ASTNode | undefined, next: number }` to `{ nodes: ASTNode[], error: string }`.

---

## Environment

```ts
// interpreter/environment.ts
type Value = number | string | boolean | null

class Environment {
  private values = new Map<string, Value>()
  constructor(private parent: Environment | null = null) {}

  define(name: string, value: Value): void   // always writes locally (new declaration)
  get(name: string): Value                   // walks up to parent; throws if not found
  set(name: string, value: Value): void      // walks up to parent; throws if not defined
}
```

Scope chain: each block (`if`/`while` body) creates a child `Environment`. Assignment (`set`) targets the nearest scope where the name is defined. Declaration (`define`) always writes to the current scope.

---

## Interpreter

```ts
// interpreter/index.ts
interpret(stmts: ASTNode[], env?: Environment): { output: string[], error: string | null }
```

Internal `evaluate(node: ASTNode, env: Environment): Value` dispatches on `node.type`:

| Node type | Behavior |
|---|---|
| `LITERAL` | return `node.expr` |
| `GROUPING` | return `evaluate(node.expr)` |
| `UNARY` | `-` negates number; `!` inverts truthiness |
| `BINARY` | arithmetic / comparison / equality; `+` is overloaded |
| `VARIABLE` | `env.get(node.name.lexeme)` |
| `ASSIGN` | `env.set(node.name, evaluate(node.value))` |
| `EXPRESSION` | evaluate and discard |
| `PRINT` | evaluate, push `String(value)` to output array |
| `VAR` | `env.define(name, expr ? evaluate(expr) : null)` |
| `IF` | evaluate condition; execute then or else branch in child scope |
| `WHILE` | loop: evaluate condition, execute body in child scope |
| `BLOCK` | execute each statement in a new child `Environment` |

Runtime errors (type mismatch, undefined variable, division by zero) are caught and returned as `{ output, error: string }`. Execution stops at first error.

---

## Runner

```ts
// runner.ts
export const run = (source: string) => {
  const scanned = scan(source)
  const parsed  = scanned.success ? parse(scanned.tokens) : { nodes: [], error: "" }
  const interpreted = parsed.error ? { output: [], error: null } : interpret(parsed.nodes)
  return { scanned, parsed, interpreted }
}
```

---

## UI Changes

**Right panel layout** (three sections):

```
┌─────────────────────────┐
│ TOKENS          (30%)   │
├─────────────────────────┤
│ AST             (35%)   │
├─────────────────────────┤
│ OUTPUT          (35%)   │  ← new
└─────────────────────────┘
```

**Output panel:**
- Header: `[RUNTIME ERROR: ...]` in red if error, `[OUTPUT]` in green otherwise
- Each `print` result on its own line
- `[no output]` in gray if program ran clean with no prints

**AST renderer** (`ASTtoString`) extended with cases for `IF`, `WHILE`, `BLOCK`, `VAR`, `PRINT`, `ASSIGN`.

---

## Code Separation

`src/lib/highlighter.ts` extracts from `index.ts`:
- `types` object (token type sets)
- `generate()` helper
- `parseToken()`
- `beautify()` — re-exported from `index.ts` for backwards compat

`index.ts` becomes a thin file: imports `run` from runner, `beautify` from highlighter, exports `BOBA` and `beautify`.
