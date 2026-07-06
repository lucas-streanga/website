/**
 * Type declarations for importing .luna source files as strings.
 *
 * Vite (under Astro) already supports the `?raw` suffix at runtime for any file;
 * this file is only what makes TypeScript agree. Make sure it is picked up:
 * either place it under `src/` beside `env.d.ts`, or add `"tooling/*.d.ts"` to
 * your tsconfig `include`.
 *
 * Usage in a page or .mdx frontmatter:
 *
 *   import LunaCode from '../tooling/LunaCode.astro';
 *   import hello from '../snippets/hello.luna?raw';
 *
 *   <LunaCode title="hello.luna" code={hello} />
 *
 * Bulk-loading a directory (an examples index page):
 *
 *   const snippets = import.meta.glob('../snippets/*.luna', {
 *     query: '?raw',
 *     import: 'default',
 *     eager: true,
 *   }) as Record<string, string>;
 *
 *   {Object.entries(snippets).map(([file, code]) => (
 *     <LunaCode title={file.split('/').pop()} code={code} />
 *   ))}
 */

declare module '*.luna?raw' {
  const source: string;
  export default source;
}

// Deliberately no bare `*.luna` declaration: importing a .luna file WITHOUT `?raw`
// has no defined meaning until a compiler-backed loader exists, and leaving it
// untyped keeps that mistake loud instead of silently `any`.
