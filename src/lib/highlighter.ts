const types = {
    single: ['COMMA', 'DOT', 'MINUS', 'PLUS', 'SEMICOLON', 'SLASH', 'STAR', 'BANG', 'EQUAL', 'GREATER', 'LESS'],
    cover: ['LEFT_PAREN', 'RIGHT_PAREN', 'LEFT_BRACE', 'RIGHT_BRACE', 'LEFT_BRACKET', 'RIGHT_BRACKET'],
    comparison: ['BANG_EQUAL', 'EQUAL_EQUAL', 'GREATER_EQUAL', 'LESS_EQUAL'],
    literals: ['IDENTIFIER', 'STRING', 'NUMBER'],
    keywords: ['AND', 'CLASS', 'ELSE', 'FALSE', 'FUN', 'FOR', 'IF', 'NIL', 'OR', 'PRINT', 'RETURN', 'SUPER', 'THIS', 'TRUE', 'LET', 'CONST', 'WHILE']
}

const generate = (varName: string, text: string) =>
    `<span style="color:var(${varName})">${text}</span>`

const parseToken = (token: Token) => {
    const { type, lexeme } = token
    if (type === "IDENTIFIER") return generate("--syn-identifier", lexeme)
    if (type === "NUMBER") return generate("--syn-number", lexeme)
    if (type === "TRUE" || type === "FALSE") return generate("--syn-identifier", lexeme)
    if (types.cover.includes(type)) return generate("--syn-bracket", lexeme)
    if (type === "PRINT") return generate("--syn-print", lexeme)
    if (type === "FUN") return generate("--syn-function", lexeme)
    if (types.single.includes(type) || types.comparison.includes(type) || types.keywords.includes(type))
        return generate("--syn-keyword", lexeme)
    if (type === "STRING")
        return `<span style="color:var(--syn-string)">${lexeme.split("\n").join(`</span>%break%<span style="color:var(--syn-string)">`)}</span>`
    if (type === "NEWLINE") return `<br/>`
    if (type === "SPACE") return generate("--syn-space", '⋅'.repeat(lexeme.length))
    return generate("--syn-identifier", lexeme)
}

export const beautify = (tokens: Token[]): string[] =>
    tokens.map(parseToken).join('').split("<br/>")
