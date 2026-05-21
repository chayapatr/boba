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

interface FunStmt {
    type: "FUN"
    name: string
    params: string[]
    body: ASTNode[]
}

interface ReturnStmt {
    type: "RETURN"
    value: ASTNode | null
}

interface CallExpr extends Expr {
    callee: ASTNode
    args: ASTNode[]
}

interface ArrayExpr extends Expr {
    elements: ASTNode[]
}

interface IndexExpr extends Expr {
    object: ASTNode
    index: ASTNode
}

interface IndexAssignExpr extends Expr {
    object: ASTNode
    index: ASTNode
    value: ASTNode
}

export type ASTNode =
    | Expr | BinaryExpr | GroupingExpr | UnaryExpr
    | VariableExpr | AssignExpr | CallExpr | ArrayExpr | IndexExpr | IndexAssignExpr
    | Stmt | VarStmt | IfStmt | WhileStmt | BlockStmt | FunStmt | ReturnStmt

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

const Fun = (name: string, params: string[], body: ASTNode[]): FunStmt =>
    ({ type: "FUN", name, params, body })

const Return = (value: ASTNode | null): ReturnStmt =>
    ({ type: "RETURN", value })

const Call = (callee: ASTNode, args: ASTNode[]): CallExpr =>
    ({ type: "CALL", callee, args })

const Array_ = (elements: ASTNode[]): ArrayExpr =>
    ({ type: "ARRAY", elements })

const Index = (object: ASTNode, index: ASTNode): IndexExpr =>
    ({ type: "INDEX", object, index })

const IndexAssign = (object: ASTNode, index: ASTNode, value: ASTNode): IndexAssignExpr =>
    ({ type: "INDEX_ASSIGN", object, index, value })

export const Stmt = { Print, Expression, Var, If, While, Block, Fun, Return }
export const Expr = { Binary, Grouping, Literal, Unary, Variable, Assign, Call, Array: Array_, Index, IndexAssign }
