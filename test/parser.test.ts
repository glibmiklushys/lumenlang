import { describe, expect, it } from "vitest";
import { parse } from "../src/parser";
import type { Expr, Stmt } from "../src/ast";

function exprOf(source: string): Expr {
  const program = parse(source);
  const stmt = program[0];
  if (stmt === undefined || stmt.kind !== "ExprStmt") {
    throw new Error("expected expression statement");
  }
  return stmt.expr;
}

describe("parser", () => {
  it("parses function declarations", () => {
    const program = parse("fn add(x, y) = x + y");
    expect(program).toHaveLength(1);
    const stmt = program[0] as Extract<Stmt, { kind: "FnDecl" }>;
    expect(stmt.kind).toBe("FnDecl");
    expect(stmt.name).toBe("add");
    expect(stmt.params).toEqual(["x", "y"]);
    expect(stmt.body.kind).toBe("Binary");
  });

  it("parses let bindings", () => {
    const program = parse("let n = 10");
    expect(program[0]).toMatchObject({ kind: "Let", name: "n" });
  });

  it("parses if-then-else expressions", () => {
    const expr = exprOf("if n < 2 then n else n + 1");
    expect(expr.kind).toBe("If");
    if (expr.kind === "If") {
      expect(expr.cond.kind).toBe("Binary");
      expect(expr.thenExpr.kind).toBe("Var");
      expect(expr.elseExpr.kind).toBe("Binary");
    }
  });

  it("parses nested calls", () => {
    const expr = exprOf("add(n, fib(8))");
    expect(expr.kind).toBe("Call");
    if (expr.kind === "Call") {
      expect(expr.callee).toBe("add");
      expect(expr.args).toHaveLength(2);
      expect(expr.args[1]?.kind).toBe("Call");
    }
  });

  it("respects * over +", () => {
    const expr = exprOf("1 + 2 * 3");
    expect(expr.kind).toBe("Binary");
    if (expr.kind === "Binary") {
      expect(expr.op).toBe("+");
      expect(expr.right.kind).toBe("Binary");
      if (expr.right.kind === "Binary") {
        expect(expr.right.op).toBe("*");
      }
    }
  });

  it("parses unary minus and parentheses", () => {
    const expr = exprOf("-(1 + 2)");
    expect(expr.kind).toBe("Unary");
    if (expr.kind === "Unary") {
      expect(expr.expr.kind).toBe("Binary");
    }
  });

  it("binds && tighter than ||", () => {
    const expr = exprOf("true || false && true");
    expect(expr.kind).toBe("Binary");
    if (expr.kind === "Binary") {
      expect(expr.op).toBe("||");
      expect(expr.right.kind).toBe("Binary");
      if (expr.right.kind === "Binary") {
        expect(expr.right.op).toBe("&&");
      }
    }
  });

  it("parses the fib program", () => {
    const program = parse(`
      fn fib(n) = if n < 2 then n else fib(n - 1) + fib(n - 2)
      let n = 10
      print(add(n, fib(8)))
    `);
    expect(program[0]?.kind).toBe("FnDecl");
    expect(program[1]?.kind).toBe("Let");
    expect(program[2]?.kind).toBe("ExprStmt");
  });

  it("throws SyntaxError with line and column", () => {
    expect(() => parse("fn = 1")).toThrow(SyntaxError);
    expect(() => parse("fn = 1")).toThrow(/1:4/);
  });

  it("throws on missing else", () => {
    expect(() => parse("if true then 1")).toThrow(SyntaxError);
    expect(() => parse("if true then 1")).toThrow(/else/);
  });
});
