interface ScanResult {
    success: boolean
}

interface ScanResultFail extends ScanResult {
    success: false
}

interface ScanResultSuccess extends ScanResult {
    success: true
    token: Token
    leap: number | [number, number]
}

interface Context {
    source: string
    start: number
    line: number
}

const panic = (context: Context) => {
    console.log(`skill issue detected at line ${context.line} -> unexpected character "${context.source[context.start]}"`)
}

/* ----- Helper Functions ----- */

const createToken = (type: TokenTypeStrings, lexeme: string = "", literal: string | number | undefined = undefined, line: number): Token => {
    return {
        type,
        lexeme,
        literal,
        line
    }
}

const isAtEnd = (location: number, context: Context): boolean => {
    return location >= context.source.length
} 

const view = (leap: number, context: Context): [boolean, string] => {
    if(isAtEnd(context.start + leap, context)) return [false, ""]
    return [true, context.source[context.start + leap]]
}

const isDigit = (char: string): boolean => {
    return char >= "0" && char <= "9"
}

const isAlpha = (char: string): boolean => {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_"
}

/* ----- Scanner Functions ----- */

interface ScanFunctionResult {
    success: boolean
}

interface ScanFunctionResultSuccess extends ScanFunctionResult {
    success: true
    token: Token
    leap: number | [number, number]
}

interface ScanFunctionResultFail extends ScanFunctionResult {
    success: false
}

type ScanFunction = (context: Context) => ScanFunctionResultSuccess | ScanFunctionResultFail

const scanSingleCharSymbol: ScanFunction = (context) => {
    const [success, char] = view(0, context)
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
        "\n": "NEWLINE"
    }
    if(success) {
        if(char in chars) return {
            success: true,
            token: createToken(chars[char], char, undefined, context.line),
            leap: char === "\n" ? [1, 1] : 1
        }
    }
    return {
        success: false
    }
}

const scanDoubleCharSymbol: ScanFunction = (context) => {
    const [success, char] = view(0, context)
    if(!success || ["=", ">", "<", "!"].indexOf(char) === -1) return { success: false }
    const [ , char2 ] = view(1, context)
    const chars: {
        [key: string]: TokenTypeStrings
    } =  {
        "==": "EQUAL_EQUAL",
        "!=": "BANG_EQUAL",
        "<=": "LESS_EQUAL",
        ">=": "GREATER_EQUAL",
        "=": "EQUAL",
        ">": "GREATER",
        "<": "LESS",
        "!": "BANG"
    }
    if(char2 === "=") {
        return {
            success: true,
            token: createToken(chars[char + char2], char + char2, undefined, context.line),
            leap: 2
        }
    } else {
        return {
            success: true,
            token: createToken(chars[char], char, undefined, context.line),
            leap: 1
        }
    }
}

const checkResult = ([success, char]: [boolean, string], fn: (char: string) => boolean): boolean => {
    if(!success) return false
    return fn(char)
}

const scanStringLiteral: ScanFunction = (context) => {
    const [success, char] = view(0, context)
    if(!success || char !== '"') return { success: false }
    let leap = 1

    while(checkResult(
            view(leap, context), 
            (char: string) => char !== '"')
        ) { leap += 1 }

    if(!checkResult(
        view(leap, context),
        (char: string) => char === '"')
    ) return { success: false }

    const literal = context.source.slice(context.start + 1, context.start + leap)
    return {
        success: true,
        token: createToken("STRING", `"${literal}"`, literal, context.line),
        leap: leap + 1
    }
}

const scanNumber: ScanFunction = (context) => {
    let viewResult = view(0, context)
    if(!viewResult[0] || !isDigit(viewResult[1])) return { success: false }
    
    let literal = viewResult[1]
    let leap = 1
    let dot = false

    viewResult = view(leap, context)

    while(viewResult[0] && (isDigit(viewResult[1]) || viewResult[1] === "." && !dot)) {
        if(viewResult[1] === ".") {
            if(!isDigit(view(leap + 1, context)[1])) {
                return {
                    success: true,
                    token: createToken("NUMBER", literal, Number(literal), context.line),
                    leap
                }
            } else dot = true
        }

        literal += viewResult[1]
        leap += 1
        viewResult = view(leap, context)
    }

    return {
        success: true,
        token: createToken("NUMBER", literal, Number(literal), context.line),
        leap
    }
}

const scanSpaces: ScanFunction = (context) => {
    const [success, char] = view(0, context)

    if(!success || ![" ", "\t", "\r"].includes(char)) return { success: false }

    let leap = 1
    while(checkResult(view(leap, context), (char: string) => [" ", "\t", "\r"].indexOf(char) !== -1)) leap += 1
    
    return {
        success: true,
        token: createToken("SPACE", "⋅".repeat(leap), undefined, context.line),
        leap
    }
}

const scanIdentifier: ScanFunction = (context) => {
    const [success, char] = view(0, context)
    if(!success || !isAlpha(char)) return { success: false}

    const symbol: { [key: string]: TokenTypeStrings } = {
        and:  "AND",
        class:  "CLASS",
        else:  "ELSE",
        false:  "FALSE",
        for:  "FOR",
        fun:  "FUN",
        if:  "IF",
        nil:  "NIL",
        or:  "OR",
        print:  "PRINT",
        return: "RETURN",
        super:  "SUPER",
        this:  "THIS",
        true:  "TRUE",
        let:  "LET",
        const: "CONST",
        while:  "WHILE",
    }

    let leap = 1
    while(checkResult(view(leap, context), (char) => isAlpha(char) || isDigit(char))) leap += 1

    const identifier = context.source.slice(context.start, context.start + leap)

    return {
        success: true,
        token: createToken(symbol[identifier] ?? "IDENTIFIER", identifier, undefined, context.line),
        leap
    }
}

/* ----- Runner Functions ----- */

const scanToken = (context: Context): ScanResultFail | ScanResultSuccess => {
    const cases = [ scanSingleCharSymbol, scanDoubleCharSymbol, scanStringLiteral, scanNumber, scanSpaces, scanIdentifier ]
    for(const c in cases) {
        const result = cases[c](context)
        if(result.success) {
            return { success: true, token: result.token, leap: result.leap }
        }
    }
    return { success: false }
}

export const scan = (source: string) => {
    const tokens: Token[] = []
    const context: Context = {
        source,
        start: 0,
        line: 1,
    }
    while(!isAtEnd(context.start, context)) {
        const result = scanToken(context)
        if(!result.success) return panic(context)
        tokens.push(result.token as Token)
        if(typeof result.leap === "number") context.start += result.leap
        else {
            context.start += result.leap[0]
            context.line += result.leap[1]
        }
    }
    return tokens
}