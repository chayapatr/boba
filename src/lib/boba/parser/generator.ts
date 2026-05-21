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
