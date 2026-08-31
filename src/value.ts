export type Value = number | boolean | string;

export function displayValue(value: Value): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

export function printValue(value: Value): string {
  if (typeof value === "string") {
    return value;
  }
  return displayValue(value);
}
