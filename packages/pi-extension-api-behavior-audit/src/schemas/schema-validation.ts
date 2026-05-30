import { readFile } from "node:fs/promises";

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

type JsonSchema = {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  minItems?: number;
  minLength?: number;
  additionalProperties?: boolean | JsonSchema;
};

export async function loadPackageJson(pathFromPackageRoot: string): Promise<unknown> {
  const url = new URL(`../../${pathFromPackageRoot}`, import.meta.url);
  return JSON.parse(await readFile(url, "utf8"));
}

export async function loadPackageSchema(pathFromPackageRoot: string): Promise<JsonSchema> {
  const schema = await loadPackageJson(pathFromPackageRoot);
  if (!isRecord(schema)) throw new SchemaValidationError(`Schema ${pathFromPackageRoot} must be an object.`);
  return schema as JsonSchema;
}

export function validateWithSchema(value: unknown, schema: JsonSchema, label = "value"): void {
  validateNode(value, schema, label);
}

function validateNode(value: unknown, schema: JsonSchema, path: string): void {
  if (Object.prototype.hasOwnProperty.call(schema, "const") && value !== schema.const) {
    throw new SchemaValidationError(`${path} must equal ${String(schema.const)}`);
  }

  if (schema.enum && !schema.enum.includes(value)) {
    throw new SchemaValidationError(`${path} must be one of: ${schema.enum.map(String).join(", ")}`);
  }

  if (schema.type) validateType(value, schema.type, path);

  if (schema.minLength !== undefined) {
    if (typeof value !== "string" || value.length < schema.minLength) {
      throw new SchemaValidationError(`${path} must be a string with length >= ${schema.minLength}`);
    }
  }

  if (schema.minItems !== undefined) {
    if (!Array.isArray(value) || value.length < schema.minItems) {
      throw new SchemaValidationError(`${path} must be an array with at least ${schema.minItems} item(s)`);
    }
  }

  if (schema.required) {
    if (!isRecord(value)) throw new SchemaValidationError(`${path} must be an object with required fields.`);
    for (const key of schema.required) {
      if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === undefined) {
        throw new SchemaValidationError(`${path}.${key} is required`);
      }
    }
  }

  if (schema.properties && isRecord(value)) {
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined) {
        validateNode(value[key], childSchema, `${path}.${key}`);
      }
    }

    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) throw new SchemaValidationError(`${path}.${key} is not allowed`);
      }
    } else if (isRecord(schema.additionalProperties)) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) validateNode(value[key], schema.additionalProperties, `${path}.${key}`);
      }
    }
  }

  if (schema.items && Array.isArray(value)) {
    value.forEach((item, index) => validateNode(item, schema.items as JsonSchema, `${path}[${index}]`));
  }
}

function validateType(value: unknown, type: string, path: string): void {
  if (type === "object") {
    if (!isRecord(value)) throw new SchemaValidationError(`${path} must be an object`);
    return;
  }
  if (type === "array") {
    if (!Array.isArray(value)) throw new SchemaValidationError(`${path} must be an array`);
    return;
  }
  if (type === "string") {
    if (typeof value !== "string") throw new SchemaValidationError(`${path} must be a string`);
    return;
  }
  if (type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) throw new SchemaValidationError(`${path} must be a number`);
    return;
  }
  if (type === "boolean") {
    if (typeof value !== "boolean") throw new SchemaValidationError(`${path} must be a boolean`);
    return;
  }
  throw new SchemaValidationError(`${path} uses unsupported schema type: ${type}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
