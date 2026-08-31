import { describe, expect, it } from "vitest";
import { formatType, infer } from "../src/index";

describe("type inference", () => {
  it("infers Int, Bool, and String literals", () => {
    expect(formatType(infer("1"))).toBe("Int");
    expect(formatType(infer("true"))).toBe("Bool");
    expect(formatType(infer(`"hi"`))).toBe("String");
  });

  it("infers arithmetic as Int", () => {
    expect(formatType(infer("1 + 2 * 3"))).toBe("Int");
    expect(formatType(infer("-4"))).toBe("Int");
  });

  it("infers comparisons and logic as Bool", () => {
    expect(formatType(infer("1 < 2"))).toBe("Bool");
    expect(formatType(infer("true && false || true"))).toBe("Bool");
    expect(formatType(infer(`"a" == "b"`))).toBe("Bool");
  });

  it("infers add as (Int, Int) -> Int", () => {
    expect(formatType(infer("fn add(x, y) = x + y"))).toBe("(Int, Int) -> Int");
  });

  it("infers fib as Int -> Int", () => {
    const src =
      "fn fib(n) = if n < 2 then n else fib(n - 1) + fib(n - 2)";
    expect(formatType(infer(src))).toBe("Int -> Int");
  });

  it("infers a polymorphic identity", () => {
    expect(formatType(infer("fn id(x) = x"))).toBe("a -> a");
  });

  it("instantiates identity at Int and Bool in the same program", () => {
    const src = `
      fn id(x) = x
      let n = id(1)
      let flag = id(true)
      flag
    `;
    expect(formatType(infer(src))).toBe("Bool");
    expect(() => infer(src)).not.toThrow();
  });

  it("instantiates identity at String as well", () => {
    const src = `
      fn id(x) = x
      id("ok")
    `;
    expect(formatType(infer(src))).toBe("String");
  });

  it("infers the K combinator as (a, b) -> a", () => {
    expect(formatType(infer("fn const(x, y) = x"))).toBe("(a, b) -> a");
  });

  it("types print as a polymorphic builtin", () => {
    expect(formatType(infer("print(1)"))).toBe("Int");
    expect(formatType(infer("print(true)"))).toBe("Bool");
  });

  it("rejects adding Int to Bool", () => {
    expect(() => infer("1 + true")).toThrow(TypeError);
    expect(() => infer("1 + true")).toThrow(/Cannot unify/);
  });

  it("rejects a non-Bool if condition", () => {
    expect(() => infer("if 1 then 2 else 3")).toThrow(TypeError);
    expect(() => infer("if 1 then 2 else 3")).toThrow(/Bool/);
  });

  it("rejects mismatched if branches", () => {
    expect(() => infer("if true then 1 else false")).toThrow(TypeError);
  });

  it("rejects undefined variables", () => {
    expect(() => infer("foo")).toThrow(TypeError);
    expect(() => infer("foo")).toThrow(/Undefined variable/);
  });

  it("rejects calling a non-function", () => {
    expect(() => infer("let x = 1\nx(2)")).toThrow(TypeError);
  });

  it("rejects occurs-check violations", () => {
    expect(() => infer("fn omega(x) = x(x)")).toThrow(TypeError);
    expect(() => infer("fn omega(x) = x(x)")).toThrow(/Infinite type/);
  });

  it("rejects wrong arity", () => {
    expect(() => infer("fn add(x, y) = x + y\nadd(1)")).toThrow(TypeError);
  });
});
