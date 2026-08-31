import type { Expr, Loc, Program, Stmt } from "./ast.js";

export type Type =
  | { tag: "TVar"; id: number }
  | { tag: "TInt" }
  | { tag: "TBool" }
  | { tag: "TString" }
  | { tag: "TFun"; params: Type[]; ret: Type };

export interface Scheme {
  vars: number[];
  type: Type;
}

export type TypeEnv = Map<string, Scheme>;

const TInt: Type = { tag: "TInt" };
const TBool: Type = { tag: "TBool" };
const TString: Type = { tag: "TString" };

export class Inferencer {
  private nextVar = 1;
  private subst = new Map<number, Type>();
  env: TypeEnv;

  constructor(env?: TypeEnv) {
    this.env = env ?? prelude();
  }

  inferProgram(program: Program): Type {
    let last: Type = TInt;
    for (const stmt of program) {
      last = this.inferStmt(stmt);
    }
    return this.apply(last);
  }

  inferStmt(stmt: Stmt): Type {
    switch (stmt.kind) {
      case "FnDecl":
        return this.inferFn(stmt);
      case "Let": {
        const t = this.inferExpr(stmt.value, this.env);
        const scheme = this.generalize(this.env, t);
        this.env.set(stmt.name, scheme);
        return this.apply(t);
      }
      case "ExprStmt":
        return this.inferExpr(stmt.expr, this.env);
      default: {
        const _never: never = stmt;
        throw new Error(`Unhandled statement ${JSON.stringify(_never)}`);
      }
    }
  }

  inferExpr(expr: Expr, env: TypeEnv): Type {
    switch (expr.kind) {
      case "Literal": {
        if (typeof expr.value === "number") {
          return TInt;
        }
        if (typeof expr.value === "boolean") {
          return TBool;
        }
        return TString;
      }
      case "Var": {
        const scheme = env.get(expr.name);
        if (scheme === undefined) {
          throw typeError(`Undefined variable '${expr.name}'`, expr.loc);
        }
        return this.instantiate(scheme);
      }
      case "Unary": {
        const t = this.inferExpr(expr.expr, env);
        this.unify(t, TInt, expr.loc, "Unary '-' expects Int");
        return TInt;
      }
      case "Binary":
        return this.inferBinary(expr, env);
      case "Call": {
        const scheme = env.get(expr.callee);
        if (scheme === undefined) {
          throw typeError(`Undefined function '${expr.callee}'`, expr.loc);
        }
        const calleeType = this.instantiate(scheme);
        const argTypes = expr.args.map((arg) => this.inferExpr(arg, env));
        const ret = this.fresh();
        this.unify(
          calleeType,
          { tag: "TFun", params: argTypes, ret },
          expr.loc,
          `Call to '${expr.callee}'`,
        );
        return this.apply(ret);
      }
      case "If": {
        const condType = this.inferExpr(expr.cond, env);
        this.unify(condType, TBool, expr.cond.loc, "If condition must be Bool");
        const thenType = this.inferExpr(expr.thenExpr, env);
        const elseType = this.inferExpr(expr.elseExpr, env);
        this.unify(
          thenType,
          elseType,
          expr.loc,
          "If branches must have the same type",
        );
        return this.apply(thenType);
      }
      default: {
        const _never: never = expr;
        throw new Error(`Unhandled expression ${JSON.stringify(_never)}`);
      }
    }
  }

  fresh(): Type {
    const id = this.nextVar;
    this.nextVar += 1;
    return { tag: "TVar", id };
  }

  apply(t: Type): Type {
    switch (t.tag) {
      case "TVar": {
        const bound = this.subst.get(t.id);
        if (bound !== undefined) {
          const resolved = this.apply(bound);
          this.subst.set(t.id, resolved);
          return resolved;
        }
        return t;
      }
      case "TFun":
        return {
          tag: "TFun",
          params: t.params.map((p) => this.apply(p)),
          ret: this.apply(t.ret),
        };
      default:
        return t;
    }
  }

  unify(a: Type, b: Type, loc: Loc, context?: string): void {
    a = this.apply(a);
    b = this.apply(b);
    if (typesEqual(a, b)) {
      return;
    }
    if (a.tag === "TVar") {
      this.bind(a.id, b, loc);
      return;
    }
    if (b.tag === "TVar") {
      this.bind(b.id, a, loc);
      return;
    }
    if (a.tag === "TFun" && b.tag === "TFun") {
      if (a.params.length !== b.params.length) {
        throw typeError(
          mismatch(
            a,
            b,
            context ??
              `function arity ${a.params.length} vs ${b.params.length}`,
          ),
          loc,
        );
      }
      for (let i = 0; i < a.params.length; i++) {
        const pa = a.params[i];
        const pb = b.params[i];
        if (pa === undefined || pb === undefined) {
          throw typeError("Internal error: missing parameter type", loc);
        }
        this.unify(pa, pb, loc, context);
      }
      this.unify(a.ret, b.ret, loc, context);
      return;
    }
    throw typeError(mismatch(a, b, context), loc);
  }

  generalize(env: TypeEnv, t: Type): Scheme {
    t = this.apply(t);
    const envVars = this.ftvEnv(env);
    const vars: number[] = [];
    for (const id of this.ftv(t)) {
      if (!envVars.has(id)) {
        vars.push(id);
      }
    }
    vars.sort((x, y) => x - y);
    return { vars, type: t };
  }

  instantiate(scheme: Scheme): Type {
    const mapping = new Map<number, Type>();
    for (const id of scheme.vars) {
      mapping.set(id, this.fresh());
    }
    return substVars(this.apply(scheme.type), mapping);
  }

  private inferFn(stmt: Extract<Stmt, { kind: "FnDecl" }>): Type {
    const paramTypes = stmt.params.map(() => this.fresh());
    const retType = this.fresh();
    const fnType: Type = { tag: "TFun", params: paramTypes, ret: retType };

    const local: TypeEnv = new Map(this.env);
    local.set(stmt.name, { vars: [], type: fnType });
    for (let i = 0; i < stmt.params.length; i++) {
      const param = stmt.params[i];
      const paramType = paramTypes[i];
      if (param === undefined || paramType === undefined) {
        throw typeError("Internal error: missing parameter", stmt.loc);
      }
      local.set(param, { vars: [], type: paramType });
    }

    const bodyType = this.inferExpr(stmt.body, local);
    this.unify(bodyType, retType, stmt.body.loc, `Body of '${stmt.name}'`);

    const applied = this.apply(fnType);
    const scheme = this.generalize(this.env, applied);
    this.env.set(stmt.name, scheme);
    return applied;
  }

  private inferBinary(
    expr: Extract<Expr, { kind: "Binary" }>,
    env: TypeEnv,
  ): Type {
    const left = this.inferExpr(expr.left, env);
    const right = this.inferExpr(expr.right, env);
    switch (expr.op) {
      case "+": {
        this.unify(left, right, expr.loc, "Operands of '+' must have the same type");
        const t = this.apply(left);
        if (t.tag === "TString") {
          return TString;
        }
        if (t.tag === "TInt") {
          return TInt;
        }
        if (t.tag === "TVar") {
          this.unify(t, TInt, expr.loc, "'+' defaults to Int when unconstrained");
          return TInt;
        }
        throw typeError(
          `Operator '+' expects Int or String, got ${formatType(t)}`,
          expr.loc,
        );
      }
      case "-":
      case "*":
      case "/": {
        this.unify(left, TInt, expr.left.loc, `Left operand of '${expr.op}' must be Int`);
        this.unify(right, TInt, expr.right.loc, `Right operand of '${expr.op}' must be Int`);
        return TInt;
      }
      case "==":
      case "!=": {
        this.unify(
          left,
          right,
          expr.loc,
          `Operands of '${expr.op}' must have the same type`,
        );
        return TBool;
      }
      case "<":
      case ">":
      case "<=":
      case ">=": {
        this.unify(left, TInt, expr.left.loc, `Left operand of '${expr.op}' must be Int`);
        this.unify(right, TInt, expr.right.loc, `Right operand of '${expr.op}' must be Int`);
        return TBool;
      }
      case "&&":
      case "||": {
        this.unify(left, TBool, expr.left.loc, `Left operand of '${expr.op}' must be Bool`);
        this.unify(right, TBool, expr.right.loc, `Right operand of '${expr.op}' must be Bool`);
        return TBool;
      }
      default: {
        const _never: never = expr.op;
        throw new Error(`Unhandled operator ${_never}`);
      }
    }
  }

  private bind(id: number, t: Type, loc: Loc): void {
    if (t.tag === "TVar" && t.id === id) {
      return;
    }
    if (this.occurs(id, t)) {
      throw typeError(
        `Infinite type: ${formatType({ tag: "TVar", id })} occurs in ${formatType(t)}`,
        loc,
      );
    }
    this.subst.set(id, t);
  }

  private occurs(id: number, t: Type): boolean {
    t = this.apply(t);
    switch (t.tag) {
      case "TVar":
        return t.id === id;
      case "TFun":
        return t.params.some((p) => this.occurs(id, p)) || this.occurs(id, t.ret);
      default:
        return false;
    }
  }

  private ftv(t: Type): Set<number> {
    t = this.apply(t);
    switch (t.tag) {
      case "TVar":
        return new Set([t.id]);
      case "TFun": {
        const ids = new Set<number>();
        for (const p of t.params) {
          for (const id of this.ftv(p)) {
            ids.add(id);
          }
        }
        for (const id of this.ftv(t.ret)) {
          ids.add(id);
        }
        return ids;
      }
      default:
        return new Set();
    }
  }

  private ftvScheme(scheme: Scheme): Set<number> {
    const ids = this.ftv(scheme.type);
    for (const v of scheme.vars) {
      ids.delete(v);
    }
    return ids;
  }

  private ftvEnv(env: TypeEnv): Set<number> {
    const ids = new Set<number>();
    for (const scheme of env.values()) {
      for (const id of this.ftvScheme(scheme)) {
        ids.add(id);
      }
    }
    return ids;
  }
}

export function inferProgram(program: Program): Type {
  return new Inferencer().inferProgram(program);
}

export function formatType(t: Type): string {
  const names = new Map<number, string>();
  const varName = (id: number): string => {
    const existing = names.get(id);
    if (existing !== undefined) {
      return existing;
    }
    const n = names.size;
    const name =
      n < 26 ? String.fromCharCode(97 + n) : `t${n}`;
    names.set(id, name);
    return name;
  };

  const show = (ty: Type, parenFun: boolean): string => {
    switch (ty.tag) {
      case "TVar":
        return varName(ty.id);
      case "TInt":
        return "Int";
      case "TBool":
        return "Bool";
      case "TString":
        return "String";
      case "TFun": {
        const args =
          ty.params.length === 1
            ? show(ty.params[0]!, true)
            : `(${ty.params.map((p) => show(p, false)).join(", ")})`;
        const rendered = `${args} -> ${show(ty.ret, false)}`;
        return parenFun ? `(${rendered})` : rendered;
      }
      default: {
        const _never: never = ty;
        return String(_never);
      }
    }
  };

  return show(t, false);
}

function prelude(): TypeEnv {
  const a: Type = { tag: "TVar", id: 0 };
  const env: TypeEnv = new Map();
  env.set("print", {
    vars: [0],
    type: { tag: "TFun", params: [a], ret: a },
  });
  return env;
}

function substVars(t: Type, mapping: Map<number, Type>): Type {
  switch (t.tag) {
    case "TVar":
      return mapping.get(t.id) ?? t;
    case "TFun":
      return {
        tag: "TFun",
        params: t.params.map((p) => substVars(p, mapping)),
        ret: substVars(t.ret, mapping),
      };
    default:
      return t;
  }
}

function typesEqual(a: Type, b: Type): boolean {
  if (a.tag !== b.tag) {
    return false;
  }
  if (a.tag === "TVar" && b.tag === "TVar") {
    return a.id === b.id;
  }
  if (a.tag === "TFun" && b.tag === "TFun") {
    if (a.params.length !== b.params.length) {
      return false;
    }
    return (
      a.params.every((p, i) => typesEqual(p, b.params[i]!)) &&
      typesEqual(a.ret, b.ret)
    );
  }
  return true;
}

function mismatch(a: Type, b: Type, context?: string): string {
  const detail = `Cannot unify ${formatType(a)} with ${formatType(b)}`;
  return context !== undefined ? `${context}: ${detail}` : detail;
}

function typeError(message: string, loc: Loc): TypeError {
  return new TypeError(`${message} at ${loc.line}:${loc.col}`);
}
