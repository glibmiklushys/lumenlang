import { Op, type CompiledProgram, type Instr } from "./compiler.js";
import type { Value } from "./value.js";
import { printValue } from "./value.js";

interface Frame {
  code: Instr[];
  ip: number;
  locals: Value[];
}

export function run(
  compiled: CompiledProgram,
  globals: Map<string, Value> = new Map(),
): Value {
  const stack: Value[] = [];
  const frames: Frame[] = [{ code: compiled.main, ip: 0, locals: [] }];

  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (frame === undefined) {
      break;
    }
    if (frame.ip >= frame.code.length) {
      frames.pop();
      continue;
    }
    const instr = frame.code[frame.ip];
    if (instr === undefined) {
      frames.pop();
      continue;
    }
    frame.ip += 1;

    switch (instr.op) {
      case Op.CONST: {
        if (instr.value === undefined) {
          throw new Error("CONST missing value");
        }
        stack.push(instr.value);
        break;
      }
      case Op.LOAD: {
        if (instr.name !== undefined) {
          const value = globals.get(instr.name);
          if (value === undefined) {
            throw new Error(`Undefined variable '${instr.name}'`);
          }
          stack.push(value);
        } else if (instr.n !== undefined) {
          const value = frame.locals[instr.n];
          if (value === undefined) {
            throw new Error(`Undefined local slot ${instr.n}`);
          }
          stack.push(value);
        } else {
          throw new Error("LOAD missing operand");
        }
        break;
      }
      case Op.STORE: {
        const value = pop(stack, "STORE");
        if (instr.name !== undefined) {
          globals.set(instr.name, value);
        } else if (instr.n !== undefined) {
          frame.locals[instr.n] = value;
        } else {
          throw new Error("STORE missing operand");
        }
        break;
      }
      case Op.ADD: {
        const b = pop(stack, "ADD");
        const a = pop(stack, "ADD");
        if (typeof a === "string" && typeof b === "string") {
          stack.push(a + b);
        } else if (typeof a === "number" && typeof b === "number") {
          stack.push(a + b);
        } else {
          throw new Error("ADD expects two numbers or two strings");
        }
        break;
      }
      case Op.SUB: {
        const b = num(pop(stack, "SUB"));
        const a = num(pop(stack, "SUB"));
        stack.push(a - b);
        break;
      }
      case Op.MUL: {
        const b = num(pop(stack, "MUL"));
        const a = num(pop(stack, "MUL"));
        stack.push(a * b);
        break;
      }
      case Op.DIV: {
        const b = num(pop(stack, "DIV"));
        const a = num(pop(stack, "DIV"));
        if (b === 0) {
          throw new Error("Division by zero");
        }
        stack.push(Math.trunc(a / b));
        break;
      }
      case Op.EQ: {
        const b = pop(stack, "EQ");
        const a = pop(stack, "EQ");
        stack.push(a === b);
        break;
      }
      case Op.NE: {
        const b = pop(stack, "NE");
        const a = pop(stack, "NE");
        stack.push(a !== b);
        break;
      }
      case Op.LT: {
        const b = num(pop(stack, "LT"));
        const a = num(pop(stack, "LT"));
        stack.push(a < b);
        break;
      }
      case Op.GT: {
        const b = num(pop(stack, "GT"));
        const a = num(pop(stack, "GT"));
        stack.push(a > b);
        break;
      }
      case Op.LE: {
        const b = num(pop(stack, "LE"));
        const a = num(pop(stack, "LE"));
        stack.push(a <= b);
        break;
      }
      case Op.GE: {
        const b = num(pop(stack, "GE"));
        const a = num(pop(stack, "GE"));
        stack.push(a >= b);
        break;
      }
      case Op.JUMP: {
        if (instr.n === undefined) {
          throw new Error("JUMP missing target");
        }
        frame.ip = instr.n;
        break;
      }
      case Op.JUMP_IF_FALSE: {
        if (instr.n === undefined) {
          throw new Error("JUMP_IF_FALSE missing target");
        }
        const cond = pop(stack, "JUMP_IF_FALSE");
        if (cond === false) {
          frame.ip = instr.n;
        }
        break;
      }
      case Op.CALL: {
        if (instr.name === undefined || instr.n === undefined) {
          throw new Error("CALL missing name or arity");
        }
        const fn = compiled.functions.get(instr.name);
        if (fn === undefined) {
          throw new Error(`Unknown function '${instr.name}'`);
        }
        const args: Value[] = [];
        for (let i = 0; i < instr.n; i++) {
          args.unshift(pop(stack, "CALL"));
        }
        frames.push({ code: fn.code, ip: 0, locals: args });
        break;
      }
      case Op.RET: {
        const value = pop(stack, "RET");
        frames.pop();
        stack.push(value);
        break;
      }
      case Op.PRINT: {
        const value = peek(stack, "PRINT");
        process.stdout.write(`${printValue(value)}\n`);
        break;
      }
      case Op.POP: {
        pop(stack, "POP");
        break;
      }
      default: {
        const _never: never = instr.op;
        throw new Error(`Unhandled opcode ${_never}`);
      }
    }
  }

  return stack.length > 0 ? stack[stack.length - 1]! : 0;
}

function pop(stack: Value[], op: string): Value {
  const value = stack.pop();
  if (value === undefined) {
    throw new Error(`Stack underflow at ${op}`);
  }
  return value;
}

function peek(stack: Value[], op: string): Value {
  const value = stack[stack.length - 1];
  if (value === undefined) {
    throw new Error(`Stack underflow at ${op}`);
  }
  return value;
}

function num(value: Value): number {
  if (typeof value !== "number") {
    throw new Error(`Expected number, got ${typeof value}`);
  }
  return value;
}
