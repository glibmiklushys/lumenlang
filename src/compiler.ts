import type { Expr, Program, Stmt } from "./ast.js";
import type { Value } from "./value.js";

export enum Op {
  CONST = 0,
  LOAD = 1,
  STORE = 2,
  ADD = 3,
  SUB = 4,
  MUL = 5,
  DIV = 6,
  EQ = 7,
  NE = 8,
  LT = 9,
  GT = 10,
  LE = 11,
  GE = 12,
  JUMP = 13,
  JUMP_IF_FALSE = 14,
  CALL = 15,
  RET = 16,
  PRINT = 17,
  POP = 18,
}

export interface Instr {
  op: Op;
  n?: number;
  name?: string;
  value?: Value;
}

export interface FuncChunk {
  name: string;
  arity: number;
  code: Instr[];
}

export interface CompiledProgram {
  functions: Map<string, FuncChunk>;
  main: Instr[];
}

export function compile(program: Program): CompiledProgram {
  const functions = new Map<string, FuncChunk>();
  for (const stmt of program) {
    if (stmt.kind === "FnDecl") {
      functions.set(stmt.name, compileFunction(stmt));
    }
  }

  const main: Instr[] = [];
  const executable = program.filter((s) => s.kind !== "FnDecl");
  if (executable.length === 0) {
    main.push({ op: Op.CONST, value: 0 });
    return { functions, main };
  }

  for (let i = 0; i < executable.length; i++) {
    const stmt = executable[i]!;
    compileStmt(stmt, main, null);
    if (i < executable.length - 1) {
      main.push({ op: Op.POP });
    }
  }
  return { functions, main };
}

function compileFunction(stmt: Extract<Stmt, { kind: "FnDecl" }>): FuncChunk {
  const locals = new Map<string, number>();
  for (let i = 0; i < stmt.params.length; i++) {
    locals.set(stmt.params[i]!, i);
  }
  const code: Instr[] = [];
  compileExpr(stmt.body, code, locals);
  code.push({ op: Op.RET });
  return { name: stmt.name, arity: stmt.params.length, code };
}

function compileStmt(stmt: Stmt, code: Instr[], locals: Map<string, number> | null): void {
  switch (stmt.kind) {
    case "FnDecl":
      return;
    case "Let":
      compileExpr(stmt.value, code, locals);
      code.push({ op: Op.STORE, name: stmt.name });
      code.push({ op: Op.LOAD, name: stmt.name });
      return;
    case "ExprStmt":
      compileExpr(stmt.expr, code, locals);
      return;
    default: {
      const _never: never = stmt;
      throw new Error(`Unhandled statement ${JSON.stringify(_never)}`);
    }
  }
}

function compileExpr(expr: Expr, code: Instr[], locals: Map<string, number> | null): void {
  switch (expr.kind) {
    case "Literal":
      code.push({ op: Op.CONST, value: expr.value });
      return;
    case "Var": {
      const slot = locals?.get(expr.name);
      if (slot !== undefined) {
        code.push({ op: Op.LOAD, n: slot });
      } else {
        code.push({ op: Op.LOAD, name: expr.name });
      }
      return;
    }
    case "Unary":
      code.push({ op: Op.CONST, value: 0 });
      compileExpr(expr.expr, code, locals);
      code.push({ op: Op.SUB });
      return;
    case "Binary":
      compileBinary(expr, code, locals);
      return;
    case "Call": {
      if (expr.callee === "print") {
        if (expr.args[0] !== undefined) {
          compileExpr(expr.args[0], code, locals);
        } else {
          code.push({ op: Op.CONST, value: 0 });
        }
        code.push({ op: Op.PRINT });
        return;
      }
      for (const arg of expr.args) {
        compileExpr(arg, code, locals);
      }
      code.push({ op: Op.CALL, name: expr.callee, n: expr.args.length });
      return;
    }
    case "If": {
      compileExpr(expr.cond, code, locals);
      const jumpFalse = emit(code, { op: Op.JUMP_IF_FALSE, n: 0 });
      compileExpr(expr.thenExpr, code, locals);
      const jumpEnd = emit(code, { op: Op.JUMP, n: 0 });
      patch(code, jumpFalse, code.length);
      compileExpr(expr.elseExpr, code, locals);
      patch(code, jumpEnd, code.length);
      return;
    }
    default: {
      const _never: never = expr;
      throw new Error(`Unhandled expression ${JSON.stringify(_never)}`);
    }
  }
}

function compileBinary(
  expr: Extract<Expr, { kind: "Binary" }>,
  code: Instr[],
  locals: Map<string, number> | null,
): void {
  switch (expr.op) {
    case "+":
    case "-":
    case "*":
    case "/":
    case "==":
    case "!=":
    case "<":
    case ">":
    case "<=":
    case ">=":
      compileExpr(expr.left, code, locals);
      compileExpr(expr.right, code, locals);
      code.push({ op: binOp(expr.op) });
      return;
    case "&&": {
      compileExpr(expr.left, code, locals);
      const jumpFalse = emit(code, { op: Op.JUMP_IF_FALSE, n: 0 });
      compileExpr(expr.right, code, locals);
      const jumpEnd = emit(code, { op: Op.JUMP, n: 0 });
      patch(code, jumpFalse, code.length);
      code.push({ op: Op.CONST, value: false });
      patch(code, jumpEnd, code.length);
      return;
    }
    case "||": {
      compileExpr(expr.left, code, locals);
      const jumpFalse = emit(code, { op: Op.JUMP_IF_FALSE, n: 0 });
      code.push({ op: Op.CONST, value: true });
      const jumpEnd = emit(code, { op: Op.JUMP, n: 0 });
      patch(code, jumpFalse, code.length);
      compileExpr(expr.right, code, locals);
      patch(code, jumpEnd, code.length);
      return;
    }
    default: {
      const _never: never = expr.op;
      throw new Error(`Unhandled operator ${_never}`);
    }
  }
}

function binOp(op: "+" | "-" | "*" | "/" | "==" | "!=" | "<" | ">" | "<=" | ">="): Op {
  switch (op) {
    case "+":
      return Op.ADD;
    case "-":
      return Op.SUB;
    case "*":
      return Op.MUL;
    case "/":
      return Op.DIV;
    case "==":
      return Op.EQ;
    case "!=":
      return Op.NE;
    case "<":
      return Op.LT;
    case ">":
      return Op.GT;
    case "<=":
      return Op.LE;
    case ">=":
      return Op.GE;
    default: {
      const _never: never = op;
      throw new Error(`Unhandled operator ${_never}`);
    }
  }
}

function emit(code: Instr[], instr: Instr): number {
  code.push(instr);
  return code.length - 1;
}

function patch(code: Instr[], index: number, target: number): void {
  const instr = code[index];
  if (instr === undefined) {
    throw new Error(`Invalid patch index ${index}`);
  }
  instr.n = target;
}
