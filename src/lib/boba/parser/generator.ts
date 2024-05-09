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
    expr: ASTNode | string
}

interface UnaryExpr extends Expr {
    opr: Opr,
    right: ASTNode
}

interface IdentifierExpr extends Expr {
    expr: ASTNode | string
}

interface VariableExpr extends Expr {
    name: Token
}

interface Stmt {
    type: string
    expr: ASTNode
}

interface VarStmt {
    type: string,
    name: string
    expr: ASTNode | null
}

export type ASTNode = Expr | BinaryExpr | GroupingExpr | UnaryExpr | IdentifierExpr | Stmt

/* AST Node Generator Function */

const Binary = (left: Expr, opr: Opr, right: Expr): BinaryExpr => {
    return { type: "BINARY", left, opr, right }
}

const Grouping = (expr: Expr): GroupingExpr => {
    return { type: "GROUPING", expr }
}

const Literal = (expr: string | number | boolean | null): LiteralExpr => {
    if (expr == null) return {type: "LITERAL", expr: "nil"} ;
    return {type: "LITERAL", expr: expr}
}

const Unary = (opr: Opr, right: Expr): UnaryExpr => {
    return { type: "UNARY", opr, right }
}

const Variable = (name: Token): VariableExpr => {
    return { type: "VARIABLE", name }
}

const Print = (expr: ASTNode): Stmt => {
    return { type: "PRINT", expr }
}

const Expression = (expr: ASTNode): Stmt => {
    return { type: "EXPRESSION", expr }
}

const Var = (name: string, expr: ASTNode | null): VarStmt => {
    return { type: "VAR", name, expr}
}

export const Stmt = {
    Print,
    Expression,
    Var
}

export const Expr = {
    Binary,
    Grouping,
    Literal,
    Unary,
    Variable
}
