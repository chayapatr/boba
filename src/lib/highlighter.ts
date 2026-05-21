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
