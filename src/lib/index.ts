import { run } from "./tea/runner"

export const TEA = (source: string) => {
    // run file
    // run prompt
    // run("+")
    return run(source)
}

const types = {
    // Single-character tokens.
    single: [
        'COMMA',
        'DOT',
        'MINUS',
        'PLUS',
        'SEMICOLON',
        'SLASH',
        'STAR',
        'BANG',
        'EQUAL',
        'GREATER',
        'LESS'
    ],
    cover: ['LEFT_PAREN', 'RIGHT_PAREN', 'LEFT_BRACE', 'RIGHT_BRACE'],
    comparison: ['BANG_EQUAL', 'EQUAL_EQUAL', 'GREATER_EQUAL', 'LESS_EQUAL'],
    literals: ['IDENTIFIER', 'STRING', 'NUMBER'],
    keywords: [
        'AND',
        'CLASS',
        'ELSE',
        'FALSE',
        'FUN',
        'FOR',
        'IF',
        'NIL',
        'OR',
        'PRINT',
        'RETURN',
        'SUPER',
        'THIS',
        'TRUE',
        'LET',
        'CONST',
        'WHILE'
    ]
};

const parseToken = (token: Token) => {
    const { type, lexeme } = token;
    if (
        types.single.includes(type) ||
        types.comparison.includes(type) ||
        types.keywords.includes(type)
    )
        return `<span class="text-red-400">${lexeme}</span>`;
    if (type === 'IDENTIFIER') return `<span class="text-blue-300">${lexeme}</span>`;
    if (type === 'STRING' || type === 'number')
        return `<span class="text-purple-300">${lexeme}</span>`;
    if (types.cover.includes(type)) return `<span class="text-neutral-300">${lexeme}</span>`;
    if (type === 'NEWLINE') return `<br/>`; // <span style="color: #666">${line + 1} |</span>
    if (type === 'SPACE') return '&nbsp;'.repeat(lexeme.length);
    return `<span class="text-neutral-50">${lexeme}</span>`;
};

export const beautify = (tokens: Token[]) => {
    return tokens.map((token) => parseToken(token)).join('').split("<br/>"); // `<span style="color: #666">1 |</span> ` +
};