/**
 * Self-contained replacements for the three @deepseek-ai runtime imports the
 * host half used to take from npm-mirror SDK packages (dsh-home-paths,
 * dsh-llm/brand, dsh-tools' defineTool).
 *
 * Why: a published copy must never resolve `@deepseek-ai/dsh-tools` from the
 * profile's node_modules — an npm-mirror dsh-tools there shadows the
 * CLI-internal build for the WHOLE base layer, and the agent loop's private
 * scheduler symbol then misses (`Cannot read properties of undefined
 * (reading 'prepare')` on every tool call). Everything here is a pure,
 * structure-compatible reimplementation of the exact behavior we relied on:
 *
 * - `dshHomePath` mirrors `join(resolve(env.DSH_HOME ?? ~/.dsh), ...segments)`;
 * - `MessageId` is the identity brand the SDK applies at runtime;
 * - `defineTool` compiles our author-facing parameter specs into the same
 *   raw JSON-Schema subset the registry expects (object/properties/required/
 *   additionalProperties/scalars; the `json` node compiles to an
 *   annotation-only schema) and pre-validates model arguments the same way.
 *
 * @module dsh-baton/host/sdk
 */
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** The ledger file's parent: the DSH user home (DSH_HOME overrides). */
export function dshHomePath(...segments: string[]): string {
  const override = process.env.DSH_HOME
  const home = resolve(override !== undefined && override.length > 0 ? override : join(homedir(), '.dsh'))
  return join(home, ...segments)
}

/** Identity brand — runtime no-op, exactly like the SDK's MessageId(). */
export function MessageId(id: string): string {
  return id
}

/** Author-facing scalar spec. */
interface ScalarSpec {
  readonly type: 'string' | 'number' | 'integer' | 'boolean' | 'null'
  readonly description?: string
  readonly enum?: readonly unknown[]
  readonly const?: unknown
}

/** Author-facing object spec (additionalProperties is mandatory). */
interface ObjectSpec {
  readonly type: 'object'
  readonly additionalProperties: boolean
  readonly description?: string
  readonly properties?: Readonly<Record<string, ValueSpec>>
}

/** Author-facing value spec. */
type ValueSpec = ScalarSpec | ObjectSpec | { readonly type: 'json' } | { readonly type: 'array'; readonly items?: ValueSpec; readonly description?: string }

/** Author-facing parameter entry (a value spec plus top-level required). */
type ParameterSpec = ValueSpec & { readonly required?: boolean }

/** Raw JSON-Schema subset node. */
type RawSchema = Record<string, unknown>

/** Compile one value spec to the raw subset (json → annotation-only). */
function compileValue(spec: ValueSpec): RawSchema {
  const node: RawSchema = {}
  const description = (spec as { description?: string }).description
  if (typeof description === 'string' && description.length > 0) node.description = description
  const type = (spec as { type?: string }).type
  if (type === undefined || type === 'json') return node
  if (type === 'object') {
    const objectSpec = spec as ObjectSpec
    node.type = 'object'
    node.additionalProperties = objectSpec.additionalProperties
    if (objectSpec.properties !== undefined) node.properties = compilePropertyMap(objectSpec.properties).properties
    return node
  }
  if (type === 'array') {
    node.type = 'array'
    const items = (spec as { items?: ValueSpec }).items
    if (items !== undefined) node.items = compileValue(items)
    return node
  }
  node.type = type
  const enumValues = (spec as ScalarSpec).enum
  if (enumValues !== undefined) node.enum = [...enumValues]
  const constValue = (spec as ScalarSpec).const
  if (constValue !== undefined) node.const = constValue
  return node
}

/** Compile a property map: properties + collected required list. */
function compilePropertyMap(spec: Readonly<Record<string, ParameterSpec>>): { properties: Record<string, RawSchema>; required?: string[] } {
  const properties: Record<string, RawSchema> = {}
  const required: string[] = []
  for (const [name, entry] of Object.entries(spec)) {
    const { required: isRequired, ...valueSpec } = entry as ParameterSpec & Record<string, unknown>
    properties[name] = compileValue(valueSpec as ValueSpec)
    if (isRequired === true) required.push(name)
  }
  return required.length > 0 ? { properties, required } : { properties }
}

/** Does a JS value match a raw-subset scalar type? */
function matchesScalarType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string': return typeof value === 'string'
    case 'number': return typeof value === 'number'
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'boolean': return typeof value === 'boolean'
    case 'null': return value === null
    default: return true
  }
}

/** Validate a value against the compiled subset; returns path-qualified violations. */
function validateValue(schema: RawSchema, value: unknown, path: string): string[] {
  if (typeof schema.type !== 'string' || schema.type.length === 0) return []
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${path} must be an object`]
    const violations: string[] = []
    const present = value as Record<string, unknown>
    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (!(key in present)) violations.push(`${path}.${key} is required`)
    }
    if (schema.additionalProperties === false) {
      const known = new Set(Object.keys((schema.properties as Record<string, RawSchema> | undefined) ?? {}))
      for (const key of Object.keys(present)) {
        if (!known.has(key)) violations.push(`${path}.${key} is not a declared property`)
      }
    }
    for (const [key, child] of Object.entries((schema.properties as Record<string, RawSchema> | undefined) ?? {})) {
      if (key in present) violations.push(...validateValue(child, present[key], `${path}.${key}`))
    }
    return violations
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${path} must be an array`]
    const violations: string[] = []
    const items = schema.items as RawSchema | undefined
    if (items !== undefined) {
      value.forEach((item, index) => { violations.push(...validateValue(items, item, `${path}[${index}]`)) })
    }
    return violations
  }
  if (!matchesScalarType(value, schema.type)) return [`${path} must be ${schema.type}`]
  // T10: enum/const are compiled into the schema — validate them at runtime
  // too, so the "pre-validates the same way" promise holds for every node.
  const enumValues = schema.enum as unknown[] | undefined
  if (enumValues !== undefined && !enumValues.some(v => v === value)) {
    return [`${path} must be one of ${enumValues.map(String).join(', ')}`]
  }
  const constValue = (schema as { const?: unknown }).const
  if (constValue !== undefined && constValue !== value) {
    return [`${path} must be ${String(constValue)}`]
  }
  return []
}

/** Options shape we consume (a structural subset of the SDK's defineTool). */
export interface DefineToolOptions<A, V> {
  readonly name: string
  readonly description: string
  readonly parameters: Readonly<Record<string, ParameterSpec>>
  readonly output: {
    readonly schema: { readonly type: 'json' }
    render(args: A, value: V): Array<{ type: 'text'; text: string }>
  }
  execute(args: A, exec: unknown): Promise<V>
}

/** A registry-ready tool definition (structure-compatible with the SDK's). */
export interface ToolDefinition<A = unknown, V = unknown> {
  readonly name: string
  readonly description: string
  readonly parameters: RawSchema
  readonly output: {
    readonly schema: RawSchema
    render(args: A, value: V): Array<{ type: 'text'; text: string }>
  }
  execute(args: A, exec: unknown): Promise<V>
}

/**
 * Define a first-party tool: compile the parameter spec, pre-validate
 * arguments (message format matches the SDK's ToolArgsError), and pass
 * through the execution.
 */
export function defineTool<A extends Record<string, unknown>, V>(options: DefineToolOptions<A, V>): ToolDefinition<A, V> {
  const compiled = compilePropertyMap(options.parameters as Readonly<Record<string, ParameterSpec>>)
  const parameters: RawSchema = { type: 'object', properties: compiled.properties }
  if (compiled.required !== undefined) parameters.required = compiled.required
  const userExecute = options.execute
  return {
    name: options.name,
    description: options.description,
    parameters,
    output: {
      // The SDK compiles the `json` node to an annotation-only schema.
      schema: {},
      render(args, value) {
        return options.output.render(args, value)
      },
    },
    async execute(args, exec) {
      const violations = validateValue(parameters, args, 'arguments')
      if (violations.length > 0) {
        throw new Error(`Error: invalid arguments: ${violations.join('; ')}`)
      }
      return userExecute(args, exec)
    },
  }
}
