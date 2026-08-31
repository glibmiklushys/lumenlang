#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { evaluate, formatType, infer, parse } from "./index.js";
import { displayValue } from "./value.js";

const args = process.argv.slice(2);

if (args.length === 0) {
  await startRepl();
} else {
  runFile(args[0]!);
}

function runFile(filePath: string): void {
  const resolved = path.resolve(filePath);
  let source: string;
  try {
    source = fs.readFileSync(resolved, "utf8");
  } catch {
    console.error(`Could not read file: ${filePath}`);
    process.exitCode = 1;
    return;
  }
  try {
    const result = evaluate(source);
    process.stdout.write(`${displayValue(result.value)}\n`);
  } catch (err) {
    printError(err);
    process.exitCode = 1;
  }
}

async function startRepl(): Promise<void> {
  process.stdout.write("Lumen 1.0.0 — :type <expr> to inspect types, :quit to exit\n");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "lumen> ",
  });

  let acc = "";
  rl.prompt();

  rl.on("line", (input) => {
    const line = input.trim();
    if (line === "") {
      rl.prompt();
      return;
    }
    if (line === ":quit" || line === ":exit") {
      rl.close();
      return;
    }
    if (line.startsWith(":type")) {
      const expr = line.slice(":type".length).trim();
      if (expr === "") {
        console.error("Usage: :type <expr>");
        rl.prompt();
        return;
      }
      try {
        const source = acc === "" ? expr : `${acc}\n${expr}`;
        console.log(formatType(infer(source)));
      } catch (err) {
        printError(err);
      }
      rl.prompt();
      return;
    }

    try {
      const next = acc === "" ? line : `${acc}\n${line}`;
      const program = parse(next);
      const result = evaluate(next);
      acc = next;
      const last = program[program.length - 1];
      if (last?.kind === "FnDecl") {
        console.log(`${last.name} : ${result.type}`);
      } else if (last?.kind === "Let") {
        console.log(`${last.name} : ${result.type} = ${displayValue(result.value)}`);
      } else {
        console.log(displayValue(result.value));
      }
    } catch (err) {
      printError(err);
    }
    rl.prompt();
  });

  await new Promise<void>((resolve) => {
    rl.on("close", () => resolve());
  });
}

function printError(err: unknown): void {
  if (err instanceof Error) {
    console.error(err.message);
    return;
  }
  console.error(String(err));
}
