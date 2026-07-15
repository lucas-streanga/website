/**
 * Type declarations for importing .luna source files as strings via `?raw`.
 *
 * Vite (under Astro) already supports `?raw` at runtime; this file only makes
 * TypeScript agree. Must be on the tsconfig include path — place under `src/`
 * beside `env.d.ts`, or add `"tooling/*.d.ts"` to `include`.
 *
 * Usage:
 *   import hello from '../snippets/hello.luna?raw';
 *   <LunaCode title="hello.luna" code={hello} />
 *
 * Bulk-load a directory with import.meta.glob(..., { query: '?raw',
 * import: 'default', eager: true }) as Record<string, string>.
 */

declare module '*.luna?raw' {
  const source: string;
  export default source;
}

// Deliberately no bare `*.luna` declaration: importing without `?raw` has no
// defined meaning until a compiler-backed loader exists; leaving it untyped keeps
// that mistake loud instead of silently `any`.
