import type { BinaryOp, Expr, Loc, Program, Stmt } from "./ast.js";
import { tokenize, type Token, type TokenType } from "./lexer.js";

export function parse(input: string | Token[]): Program {
  const tokens = typeof input === "string" ? tokenize(input) : input;
  return new Parser(tokens).parseProgram();
}

export function parseExpression(input: string | Token[]): Expr {
  const tokens = typeof input === "string" ? tokenize(input) : input;
  return new Parser(tokens).parseOneExpr();
}

class Parser {
  private readonly tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseProgram(): Program {
    const stmts: Stmt[] = [];
    while (!this.check("EOF")) {
      stmts.push(this.parseStmt());
    }
    return stmts;
  }

  parseOneExpr(): Expr {
    const expr = this.parseExpr();
    if (!this.check("EOF")) {
      const tok = this.peek();
      throw new SyntaxError(
        `Unexpected token '${tok.lexeme}' at ${tok.line}:${tok.col}`,
      );
    }
    return expr;
  }

  private parseStmt(): Stmt {
    if (this.check("FN")) {
      return this.parseFnDecl();
    }
    if (this.check("LET")) {
      return this.parseLet();
    }
    const expr = this.parseExpr();
    return { kind: "ExprStmt", expr, loc: expr.loc };
  }

  private parseFnDecl(): Stmt {
    const fnTok = this.expect("FN");
    const name = this.expect("IDENT").lexeme;
    this.expect("LPAREN");
    const params: string[] = [];
    if (!this.check("RPAREN")) {
      params.push(this.expect("IDENT").lexeme);
      while (this.match("COMMA")) {
        params.push(this.expect("IDENT").lexeme);
      }
    }
    this.expect("RPAREN");
    this.expect("EQ");
    const body = this.parseExpr();
    return { kind: "FnDecl", name, params, body, loc: locOf(fnTok) };
  }

  private parseLet(): Stmt {
    const letTok = this.expect("LET");
    const name = this.expect("IDENT").lexeme;
    this.expect("EQ");
    const value = this.parseExpr();
    return { kind: "Let", name, value, loc: locOf(letTok) };
  }

  private parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.check("OR")) {
      const opTok = this.advance();
      const right = this.parseAnd();
      left = binary("||", left, right, opTok);
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseEquality();
    while (this.check("AND")) {
      const opTok = this.advance();
      const right = this.parseEquality();
      left = binary("&&", left, right, opTok);
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseComparison();
    while (this.check("EQEQ") || this.check("NEQ")) {
      const opTok = this.advance();
      const right = this.parseComparison();
      left = binary(opTok.type === "EQEQ" ? "==" : "!=", left, right, opTok);
    }
    return left;
  }

  private parseComparison(): Expr {
    let left = this.parseAdd();
    while (
      this.check("LT") ||
      this.check("GT") ||
      this.check("LTE") ||
      this.check("GTE")
    ) {
      const opTok = this.advance();
      const right = this.parseAdd();
      const op: BinaryOp =
        opTok.type === "LT"
          ? "<"
          : opTok.type === "GT"
            ? ">"
            : opTok.type === "LTE"
              ? "<="
              : ">=";
      left = binary(op, left, right, opTok);
    }
    return left;
  }

  private parseAdd(): Expr {
    let left = this.parseMul();
    while (this.check("PLUS") || this.check("MINUS")) {
      const opTok = this.advance();
      const right = this.parseMul();
      left = binary(opTok.type === "PLUS" ? "+" : "-", left, right, opTok);
    }
    return left;
  }

  private parseMul(): Expr {
    let left = this.parseUnary();
    while (this.check("STAR") || this.check("SLASH")) {
      const opTok = this.advance();
      const right = this.parseUnary();
      left = binary(opTok.type === "STAR" ? "*" : "/", left, right, opTok);
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.check("MINUS")) {
      const opTok = this.advance();
      const expr = this.parseUnary();
      return { kind: "Unary", op: "-", expr, loc: locOf(opTok) };
    }
    return this.parseCall();
  }

  private parseCall(): Expr {
    let expr = this.parsePrimary();
    while (this.check("LPAREN")) {
      if (expr.kind !== "Var") {
        const tok = this.peek();
        throw new SyntaxError(
          `Only named functions can be called at ${tok.line}:${tok.col}`,
        );
      }
      const loc = expr.loc;
      const callee = expr.name;
      this.advance();
      const args: Expr[] = [];
      if (!this.check("RPAREN")) {
        args.push(this.parseExpr());
        while (this.match("COMMA")) {
          args.push(this.parseExpr());
        }
      }
      this.expect("RPAREN");
      expr = { kind: "Call", callee, args, loc };
    }
    return expr;
  }

  private parsePrimary(): Expr {
    if (this.check("NUMBER") || this.check("STRING") || this.check("TRUE") || this.check("FALSE")) {
      const tok = this.advance();
      if (tok.literal === undefined) {
        throw new SyntaxError(`Missing literal at ${tok.line}:${tok.col}`);
      }
      return { kind: "Literal", value: tok.literal, loc: locOf(tok) };
    }

    if (this.check("IDENT")) {
      const tok = this.advance();
      return { kind: "Var", name: tok.lexeme, loc: locOf(tok) };
    }

    if (this.check("LPAREN")) {
      this.advance();
      const expr = this.parseExpr();
      this.expect("RPAREN");
      return expr;
    }

    if (this.check("IF")) {
      const ifTok = this.advance();
      const cond = this.parseExpr();
      this.expect("THEN");
      const thenExpr = this.parseExpr();
      this.expect("ELSE");
      const elseExpr = this.parseExpr();
      return { kind: "If", cond, thenExpr, elseExpr, loc: locOf(ifTok) };
    }

    const tok = this.peek();
    throw new SyntaxError(
      `Unexpected token '${tok.lexeme}' at ${tok.line}:${tok.col}`,
    );
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    const tok = this.peek();
    if (tok.type !== "EOF") {
      this.current += 1;
    }
    return tok;
  }

  private expect(type: TokenType): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      const found = tok.type === "EOF" ? "end of input" : `'${tok.lexeme}'`;
      throw new SyntaxError(
        `Expected ${tokenLabel(type)} but found ${found} at ${tok.line}:${tok.col}`,
      );
    }
    return this.advance();
  }

  private peek(): Token {
    const tok = this.tokens[this.current];
    if (tok === undefined) {
      const last = this.tokens[this.tokens.length - 1];
      return last ?? { type: "EOF", lexeme: "", line: 1, col: 1 };
    }
    return tok;
  }
}

function locOf(token: Token): Loc {
  return { line: token.line, col: token.col };
}

function binary(op: BinaryOp, left: Expr, right: Expr, opTok: Token): Expr {
  return { kind: "Binary", op, left, right, loc: locOf(opTok) };
}

function tokenLabel(type: TokenType): string {
  switch (type) {
    case "FN":
      return "'fn'";
    case "LET":
      return "'let'";
    case "IF":
      return "'if'";
    case "THEN":
      return "'then'";
    case "ELSE":
      return "'else'";
    case "IDENT":
      return "identifier";
    case "EQ":
      return "'='";
    case "LPAREN":
      return "'('";
    case "RPAREN":
      return "')'";
    case "COMMA":
      return "','";
    default:
      return type;
  }
}
