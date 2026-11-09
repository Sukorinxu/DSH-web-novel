// Local test-only shim of @deepseek-ai/schemastery.
//
// WHY: this workspace cannot symlink the real Harness SDK (the DSH checkout lives
// inside app.asar), and lib/index.js only needs Config construction + default
// resolution for unit tests. The real package is a callable Schema builder:
//   const Config = z.object({ a: z.number().default(1) })
//   Config({})            // => { a: 1 }
//   Config({ a: 2 })      // => { a: 2 }
// This file implements exactly that subset (object/string/number/boolean/const/
// union/array/default) so `node test/*.mjs` runs without the host SDK. It is NOT
// the real validator: it does not reject unknown fields or type mismatches.
// node_modules/ is gitignored and this package is never part of the bundle.

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function make(spec) {
    const schema = (input) => resolve(spec, input === undefined ? {} : input);
    schema.__spec = spec;
    schema.default = (value) => make({ ...spec, def: value, hasDef: true });
    return schema;
}

function resolve(spec, input) {
    // Shape entries are Schema functions; unwrap to their spec before dispatch.
    if (typeof spec === 'function' && spec.__spec) spec = spec.__spec;
    switch (spec.kind) {
        case 'object': {
            if (input === undefined || input === null) {
                return spec.hasDef ? resolve({ ...spec, hasDef: false }, spec.def) : undefined;
            }
            const src = typeof input === 'object' ? input : {};
            const out = {};
            for (const [key, child] of Object.entries(spec.shape)) {
                const value = resolve(child, hasOwn(src, key) ? src[key] : undefined);
                if (value !== undefined) out[key] = value;
            }
            return out;
        }
        case 'number':
            if (typeof input === 'number') return input;
            return spec.hasDef ? spec.def : undefined;
        case 'string':
            if (typeof input === 'string') return input;
            return spec.hasDef ? spec.def : undefined;
        case 'boolean':
            if (typeof input === 'boolean') return input;
            return spec.hasDef ? spec.def : undefined;
        case 'const':
            return input === spec.value ? input : (spec.hasDef ? spec.def : undefined);
        case 'array': {
            if (Array.isArray(input)) return input;
            return spec.hasDef ? spec.def : undefined;
        }
        case 'union': {
            for (const option of spec.options) {
                const value = resolve(option, input);
                if (value !== undefined) return value;
            }
            return spec.hasDef ? spec.def : undefined;
        }
        default:
            return input;
    }
}

const z = {
    object: (shape = {}) => make({ kind: 'object', shape }),
    string: () => make({ kind: 'string' }),
    number: () => make({ kind: 'number' }),
    boolean: () => make({ kind: 'boolean' }),
    const: (value) => make({ kind: 'const', value }),
    union: (options) => make({ kind: 'union', options }),
    array: (item) => make({ kind: 'array', item }),
};

export default z;
