export type LiteralValue = number | boolean | string;

export type BinaryOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "=="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "&&"
  | "||";

export interface Loc {
  line: number;
  col: number;
}

export type Expr =
  | { kind: "Literal"; value: LiteralValue; loc: Loc }
  | { kind: "Var"; name: string; loc: Loc }
  | { kind: "Unary"; op: "-"; expr: Expr; loc: Loc }
  | { kind: "Binary"; op: BinaryOp; left: Expr; right: Expr; loc: Loc }
  | { kind: "Call"; callee: string; args: Expr[]; loc: Loc }
  | { kind: "If"; cond: Expr; thenExpr: Expr; elseExpr: Expr; loc: Loc };

export type Stmt =
  | { kind: "FnDecl"; name: string; params: string[]; body: Expr; loc: Loc }
  | { kind: "Let"; name: string; value: Expr; loc: Loc }
  | { kind: "ExprStmt"; expr: Expr; loc: Loc };

export type Program = Stmt[];
