import { describe, expect, it } from "vitest";
import { tokenize } from "../src/lexer";

function types(source: string): string[] {
  return tokenize(source).map((t) => t.type);
}

describe("lexer", () => {
  it("tokenizes an empty program as EOF", () => {
    const tokens = tokenize("");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.type).toBe("EOF");
    expect(tokens[0]?.line).toBe(1);
    expect(tokens[0]?.col).toBe(1);
  });

  it("tokenizes keywords, identifiers, and numbers", () => {
    expect(types("fn add(x, y) = x + y")).toEqual([
      "FN",
      "IDENT",
      "LPAREN",
      "IDENT",
      "COMMA",
      "IDENT",
      "RPAREN",
      "EQ",
      "IDENT",
      "PLUS",
      "IDENT",
      "EOF",
    ]);
  });

  it("tokenizes booleans and strings", () => {
    const tokens = tokenize(`true false "hello"`);
    expect(tokens[0]?.type).toBe("TRUE");
    expect(tokens[0]?.literal).toBe(true);
    expect(tokens[1]?.type).toBe("FALSE");
    expect(tokens[1]?.literal).toBe(false);
    expect(tokens[2]?.type).toBe("STRING");
    expect(tokens[2]?.literal).toBe("hello");
  });

  it("tokenizes comparison and logical operators", () => {
    expect(types("== != < > <= >= && ||")).toEqual([
      "EQEQ",
      "NEQ",
      "LT",
      "GT",
      "LTE",
      "GTE",
      "AND",
      "OR",
      "EOF",
    ]);
  });

  it("tokenizes arithmetic and punctuation", () => {
    expect(types("+ - * / ( ) , =")).toEqual([
      "PLUS",
      "MINUS",
      "STAR",
      "SLASH",
      "LPAREN",
      "RPAREN",
      "COMMA",
      "EQ",
      "EOF",
    ]);
  });

  it("skips // comments", () => {
    expect(types("1 // comment\n+ 2")).toEqual(["NUMBER", "PLUS", "NUMBER", "EOF"]);
  });

  it("tracks line and column", () => {
    const tokens = tokenize("fn\n  add");
    expect(tokens[0]).toMatchObject({ type: "FN", line: 1, col: 1 });
    expect(tokens[1]).toMatchObject({ type: "IDENT", lexeme: "add", line: 2, col: 3 });
  });

  it("decodes string escapes", () => {
    const tokens = tokenize(`"a\\nb\\t\\"c\\\\"`);
    expect(tokens[0]?.literal).toBe("a\nb\t\"c\\");
  });

  it("throws SyntaxError on unexpected characters", () => {
    expect(() => tokenize("@")).toThrow(SyntaxError);
    expect(() => tokenize("@")).toThrow(/1:1/);
  });

  it("throws SyntaxError on unterminated strings", () => {
    expect(() => tokenize(`"oops`)).toThrow(SyntaxError);
    expect(() => tokenize(`"oops`)).toThrow(/Unterminated string/);
  });
});
