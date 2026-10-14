## `validate` in src/gateway/security.js (L24-L52)

**Purpose:** Enforces the closed capability and grant schema subset before authority-sensitive use.

**Inputs & Assumptions:** Value is untrusted JSON. Schema is trusted static registry data. HTTP body size is capped at 16 KiB (`routes/gateway.js:L70-L71`).

**Outputs & Effects:** Returns the input unchanged or throws `invalid_arguments`; no database writes (`L25-L51`).

**Block-by-Block:**

```js
// L29-L32
if ((schema.required || []).some((key) => !Object.hasOwn(value, key))) fail('invalid_arguments');
```

Required own fields and per-entry own schema membership precede recursive validation. This establishes closed objects without coercion for downstream dispatch. Arrays enforce size/uniqueness/item schemas; primitives enforce type, ranges, string patterns, and supported date format (`L34-L50`).

**Cross-Function Dependencies:** Calls `fail` (`L13`) and canonical sorting for unique-array comparison (`L15-L20,L37`). Callers include grants, capability invocation, confirmations and route framing. Schemas never come from the caller (`L55-L60`; `service.js:L59,L77-L78`).

**Open Questions:** General JSON Schema features are intentionally absent. Any future registry schema using unsupported keywords needs a separate compatibility check.
