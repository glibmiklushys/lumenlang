import { describe, expect, it } from "vitest";
import { evaluate } from "../src/index";

describe("evaluate", () => {
  it("computes fib(10) = 55", () => {
    const result = evaluate(
      "fn fib(n) = if n < 2 then n else fib(n - 1) + fib(n - 2)\nfib(10)",
    );
    expect(result.value).toBe(55);
    expect(result.type).toBe("Int");
  });

  it("computes add(2, 3) = 5", () => {
    const result = evaluate("fn add(x, y) = x + y\nadd(2, 3)");
    expect(result.value).toBe(5);
    expect(result.type).toBe("Int");
  });

  it("evaluates if true then 1 else 0", () => {
    const result = evaluate("if true then 1 else 0");
    expect(result.value).toBe(1);
    expect(result.type).toBe("Int");
  });

  it("evaluates if false then 1 else 0", () => {
    expect(evaluate("if false then 1 else 0").value).toBe(0);
  });

  it("concatenates strings with +", () => {
    const result = evaluate(`"foo" + "bar"`);
    expect(result.value).toBe("foobar");
    expect(result.type).toBe("String");
  });

  it("runs the sample program with nested calls", () => {
    const result = evaluate(`
      fn add(x, y) = x + y
      fn fib(n) = if n < 2 then n else fib(n - 1) + fib(n - 2)
      let n = 10
      print(add(n, fib(8)))
    `);
    expect(result.value).toBe(31);
  });

  it("supports unary minus, comparisons, and booleans", () => {
    expect(evaluate("-3 + 5").value).toBe(2);
    expect(evaluate("1 == 1").value).toBe(true);
    expect(evaluate("1 != 2").value).toBe(true);
    expect(evaluate("2 <= 2 && 3 > 1").value).toBe(true);
    expect(evaluate("false || true").value).toBe(true);
  });

  it("short-circuits && and ||", () => {
    expect(evaluate("false && true").value).toBe(false);
    expect(evaluate("true || false").value).toBe(true);
  });

  it("binds lets into later expressions", () => {
    expect(evaluate("let n = 10\nn + 1").value).toBe(11);
  });

  it("uses integer division", () => {
    expect(evaluate("5 / 2").value).toBe(2);
  });

  it("returns polymorphic results after instantiation", () => {
    expect(evaluate("fn id(x) = x\nid(true)").value).toBe(true);
    expect(evaluate(`fn id(x) = x\nid("ok")`).value).toBe("ok");
  });
});
