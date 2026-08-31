import type { LiteralValue } from "./ast.js";

export type TokenType =
  | "FN"
  | "LET"
  | "IF"
  | "THEN"
  | "ELSE"
  | "TRUE"
  | "FALSE"
  | "IDENT"
  | "NUMBER"
  | "STRING"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "EQEQ"
  | "NEQ"
  | "LT"
  | "GT"
  | "LTE"
  | "GTE"
  | "AND"
  | "OR"
  | "EQ"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

export interface Token {
  type: TokenType;
  lexeme: string;
  literal?: LiteralValue;
  line: number;
  col: number;
}

const KEYWORDS: Record<string, TokenType> = {
  fn: "FN",
  let: "LET",
  if: "IF",
  then: "THEN",
  else: "ELSE",
  true: "TRUE",
  false: "FALSE",
};

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const peek = (offset = 0): string => source[i + offset] ?? "";

  const advance = (): string => {
    const ch = source[i] ?? "";
    i += 1;
    if (ch === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
    return ch;
  };

  const push = (
    type: TokenType,
    lexeme: string,
    startLine: number,
    startCol: number,
    literal?: LiteralValue,
  ): void => {
    const token: Token = { type, lexeme, line: startLine, col: startCol };
    if (literal !== undefined) {
      token.literal = literal;
    }
    tokens.push(token);
  };

  while (i < source.length) {
    const startLine = line;
    const startCol = col;
    const ch = peek();

    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      advance();
      continue;
    }

    if (ch === "/" && peek(1) === "/") {
      while (peek() !== "" && peek() !== "\n") {
        advance();
      }
      continue;
    }

    if (isDigit(ch)) {
      let lexeme = "";
      while (isDigit(peek())) {
        lexeme += advance();
      }
      push("NUMBER", lexeme, startLine, startCol, Number(lexeme));
      continue;
    }

    if (isIdentStart(ch)) {
      let lexeme = "";
      while (isIdentPart(peek())) {
        lexeme += advance();
      }
      const kw = KEYWORDS[lexeme];
      if (kw === "TRUE") {
        push(kw, lexeme, startLine, startCol, true);
      } else if (kw === "FALSE") {
        push(kw, lexeme, startLine, startCol, false);
      } else if (kw !== undefined) {
        push(kw, lexeme, startLine, startCol);
      } else {
        push("IDENT", lexeme, startLine, startCol);
      }
      continue;
    }

    if (ch === '"') {
      advance();
      let value = "";
      let closed = false;
      while (peek() !== "") {
        if (peek() === '"') {
          advance();
          closed = true;
          break;
        }
        if (peek() === "\n") {
          break;
        }
        if (peek() === "\\") {
          advance();
          const esc = advance();
          switch (esc) {
            case "n":
              value += "\n";
              break;
            case "t":
              value += "\t";
              break;
            case "r":
              value += "\r";
              break;
            case '"':
              value += '"';
              break;
            case "\\":
              value += "\\";
              break;
            default:
              throw new SyntaxError(
                `Invalid escape sequence \\${esc} at ${startLine}:${startCol}`,
              );
          }
          continue;
        }
        value += advance();
      }
      if (!closed) {
        throw new SyntaxError(`Unterminated string at ${startLine}:${startCol}`);
      }
      push("STRING", `"${value}"`, startLine, startCol, value);
      continue;
    }

    if (ch === "=" && peek(1) === "=") {
      advance();
      advance();
      push("EQEQ", "==", startLine, startCol);
      continue;
    }
    if (ch === "!" && peek(1) === "=") {
      advance();
      advance();
      push("NEQ", "!=", startLine, startCol);
      continue;
    }
    if (ch === "<" && peek(1) === "=") {
      advance();
      advance();
      push("LTE", "<=", startLine, startCol);
      continue;
    }
    if (ch === ">" && peek(1) === "=") {
      advance();
      advance();
      push("GTE", ">=", startLine, startCol);
      continue;
    }
    if (ch === "&" && peek(1) === "&") {
      advance();
      advance();
      push("AND", "&&", startLine, startCol);
      continue;
    }
    if (ch === "|" && peek(1) === "|") {
      advance();
      advance();
      push("OR", "||", startLine, startCol);
      continue;
    }

    switch (ch) {
      case "+":
        advance();
        push("PLUS", "+", startLine, startCol);
        continue;
      case "-":
        advance();
        push("MINUS", "-", startLine, startCol);
        continue;
      case "*":
        advance();
        push("STAR", "*", startLine, startCol);
        continue;
      case "/":
        advance();
        push("SLASH", "/", startLine, startCol);
        continue;
      case "<":
        advance();
        push("LT", "<", startLine, startCol);
        continue;
      case ">":
        advance();
        push("GT", ">", startLine, startCol);
        continue;
      case "=":
        advance();
        push("EQ", "=", startLine, startCol);
        continue;
      case "(":
        advance();
        push("LPAREN", "(", startLine, startCol);
        continue;
      case ")":
        advance();
        push("RPAREN", ")", startLine, startCol);
        continue;
      case ",":
        advance();
        push("COMMA", ",", startLine, startCol);
        continue;
      default:
        throw new SyntaxError(
          `Unexpected character '${ch}' at ${startLine}:${startCol}`,
        );
    }
  }

  tokens.push({ type: "EOF", lexeme: "", line, col });
  return tokens;
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isIdentStart(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}
