import type { Program } from "./ast.js";
import { compile } from "./compiler.js";
import { formatType, inferProgram, type Type } from "./infer.js";
import { parse } from "./parser.js";
import type { Value } from "./value.js";
import { run } from "./vm.js";

export { tokenize } from "./lexer.js";
export { parse, parseExpression } from "./parser.js";
export { inferProgram, formatType, Inferencer } from "./infer.js";
export { compile, Op } from "./compiler.js";
export { run } from "./vm.js";
export { displayValue, printValue } from "./value.js";
export type { Value } from "./value.js";
export type { Program, Expr, Stmt } from "./ast.js";
export type { Type, Scheme } from "./infer.js";
export type { CompiledProgram, Instr, FuncChunk } from "./compiler.js";
export type { Token, TokenType } from "./lexer.js";

export function infer(input: string | Program): Type {
  const program = typeof input === "string" ? parse(input) : input;
  return inferProgram(program);
}

export function evaluate(source: string): { value: Value; type: string } {
  const program = parse(source);
  const type = inferProgram(program);
  const compiled = compile(program);
  const value = run(compiled);
  return { value, type: formatType(type) };
}
