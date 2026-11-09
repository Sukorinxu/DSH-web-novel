// Local test-only shim of @deepseek-ai/dsh-tools.
//
// WHY: this workspace cannot symlink the real Harness SDK (the DSH checkout lives
// inside app.asar), yet the plugin's own test suite intentionally boots the plugin
// against the host tool SDK. This file implements the two members the suite uses:
//   · defineTool(options) — normalize the plugin's parameter spec into JSON Schema
//     (the host does `parameterSchemaSpecToJsonSchema` inside defineTool);
//   · validateJsonSchemaValue(schema, value) — basic structural validation used by
//     the output-contract tests.
// It is NOT byte-identical to the host: it does not enforce host-only metadata,
// render wrapping, or every JSON Schema keyword. node_modules/ is gitignored and
// this package is never part of the bundle.

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** 插件参数表（{ name: {type, required, description, enum} }）→ JSON Schema。 */
export function parameterSchemaSpecToJsonSchema(spec) {
    const properties = {};
    const required = [];
    for (const [name, raw] of Object.entries(spec ?? {})) {
        const item = raw ?? {};
        const prop = {};
        if (item.type !== undefined) prop.type = item.type === 'integer' ? 'integer' : item.type;
        if (item.description !== undefined) prop.description = item.description;
        if (item.enum !== undefined) prop.enum = item.enum;
        if (item.default !== undefined) prop.default = item.default;
        if (item.minimum !== undefined) prop.minimum = item.minimum;
        if (item.maximum !== undefined) prop.maximum = item.maximum;
        if (item.items !== undefined) prop.items = item.items;
        if (item.properties !== undefined) {
            prop.type = 'object';
            prop.properties = item.properties;
            prop.additionalProperties = item.additionalProperties ?? false;
            if (Array.isArray(item.required)) prop.required = item.required;
        }
        properties[name] = prop;
        if (item.required === true) required.push(name);
    }
    const schema = { type: 'object', properties, additionalProperties: false };
    if (required.length > 0) schema.required = required;
    return schema;
}

/** 宿主 defineTool 会把「属性级 required:true」折叠成对象级 required 数组；照做。 */
function normalizeSchema(schema) {
    if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return schema;
    const out = { ...schema };
    if (out.properties !== undefined && out.properties !== null && typeof out.properties === 'object') {
        const props = {};
        const required = Array.isArray(out.required) ? [...out.required] : [];
        for (const [key, rawSchema] of Object.entries(out.properties)) {
            const child = { ...(rawSchema ?? {}) };
            if (child.required === true) {
                required.push(key);
                delete child.required;
            }
            props[key] = normalizeSchema(child);
        }
        out.properties = props;
        if (required.length > 0) out.required = [...new Set(required)];
    }
    if (out.items !== undefined) out.items = normalizeSchema(out.items);
    if (Array.isArray(out.oneOf)) out.oneOf = out.oneOf.map(normalizeSchema);
    if (Array.isArray(out.anyOf)) out.anyOf = out.anyOf.map(normalizeSchema);
    return out;
}

/** 宿主 defineTool：返回可注册的工具对象（参数已归一为 JSON Schema）。 */
export function defineTool(options = {}) {
    const { name, description, parameters, output, execute, render, presentationMeta, ...rest } = options;
    const parameterSchema = parameters !== undefined && parameters.type !== 'object'
        ? parameterSchemaSpecToJsonSchema(parameters)
        : (parameters ?? { type: 'object', properties: {} });
    const tool = {
        name,
        description,
        parameters: normalizeSchema(parameterSchema),
        ...rest,
    };
    if (output !== undefined) tool.output = { ...output };
    else if (render !== undefined || presentationMeta !== undefined) tool.output = {};
    if (tool.output !== undefined) {
        if (tool.output.schema !== undefined) tool.output.schema = normalizeSchema(tool.output.schema);
        if (render !== undefined && tool.output.render === undefined) tool.output.render = render;
        if (presentationMeta !== undefined && tool.output.presentationMeta === undefined) tool.output.presentationMeta = presentationMeta;
    }
    if (typeof execute === 'function') {
        // 宿主把执行包成异步：同步抛错要变成 rejected promise（测试按 reject 断言）。
        tool.execute = (...args) => Promise.resolve().then(() => execute(...args));
    }
    return tool;
}

function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
    return typeof value;
}

/** 基本 JSON Schema 结构校验：返回违规文案数组（空数组 = 通过）。 */
export function validateJsonSchemaValue(schema, value, at = '$') {
    const violations = [];
    if (schema === undefined || schema === null || typeof schema !== 'object') return violations;

    if (schema.type !== undefined) {
        const actual = typeOf(value);
        const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
        const matches = expected.some((t) => (t === 'number' ? (actual === 'number' || actual === 'integer') : t === actual));
        if (!matches) {
            violations.push(`${at}: 类型应为 ${expected.join('|')}，实际 ${actual}`);
            return violations;
        }
    }
    if (schema.const !== undefined && value !== schema.const) {
        violations.push(`${at}: 期望常量 ${JSON.stringify(schema.const)}`);
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
        violations.push(`${at}: 值 ${JSON.stringify(value)} 不在枚举 ${JSON.stringify(schema.enum)} 内`);
    }
    if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
        const ok = schema.oneOf.some((sub) => validateJsonSchemaValue(sub, value, at).length === 0);
        if (!ok) violations.push(`${at}: 不匹配任何 oneOf 分支`);
    }
    if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
        const ok = schema.anyOf.some((sub) => validateJsonSchemaValue(sub, value, at).length === 0);
        if (!ok) violations.push(`${at}: 不匹配任何 anyOf 分支`);
    }
    if (schema.type === 'object' || schema.properties !== undefined) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            const requiredList = Array.isArray(schema.required) ? schema.required : [];
            for (const key of requiredList) {
                if (!hasOwn(value, key)) violations.push(`${at}: 缺少必填字段 ${key}`);
            }
            for (const [key, sub] of Object.entries(schema.properties ?? {})) {
                if (hasOwn(value, key) && value[key] !== undefined) {
                    violations.push(...validateJsonSchemaValue(sub, value[key], `${at}.${key}`));
                }
            }
            if (schema.additionalProperties === false) {
                for (const key of Object.keys(value)) {
                    if (!hasOwn(schema.properties ?? {}, key)) violations.push(`${at}: 不允许的字段 ${key}`);
                }
            }
        }
    }
    if (schema.type === 'array' && Array.isArray(value) && schema.items !== undefined) {
        value.forEach((item, index) => violations.push(...validateJsonSchemaValue(schema.items, item, `${at}[${index}]`)));
    }
    return violations;
}

export default { defineTool, validateJsonSchemaValue, parameterSchemaSpecToJsonSchema };
