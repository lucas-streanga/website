/**
 * remark-luna-fences — render ```luna fenced code blocks with <LunaCode>.
 *
 * Rewrites every ```luna block into <LunaCode code={...} />, so an author writes
 * a plain fence and gets the framed, syntax-highlighted card (caption + copy
 * button) instead of a bare <pre>. `title="foo"` on the info string becomes the caption.
 *
 * Wiring (two halves, both required):
 *   1. astro.config.mjs → markdown.remarkPlugins: [remarkLunaFences]
 *   2. the page rendering the post provides the component to MDX:
 *        <Content components={{ LunaCode }} />
 *      MDX resolves the injected <LunaCode> from that map, so posts need no
 *      per-file `import`. (A post that DOES import LunaCode still works — the
 *      local import simply shadows the provided one.)
 *
 * MDX only: the injected node is an mdxJsxFlowElement, which the plain-Markdown
 * (.md) compiler can't emit. Every post here is .mdx, so ```luna lives in .mdx.
 *
 * Runs at the remark (mdast) stage, before Astro's Shiki highlighting (a rehype
 * step). By the time Shiki runs, the luna `code` node is already a JSX element,
 * so Shiki ignores it and never needs the grammar registered in shikiConfig.
 */

// title="..." or title='...' on the fence info string → caption.
const TITLE = /\btitle\s*=\s*(?:"([^"]*)"|'([^']*)')/;

export default function remarkLunaFences() {
    return (tree) => {
        walk(tree);
    };
}

function walk(node) {
    if (!node || !Array.isArray(node.children)) return;
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child.type === "code" && child.lang === "luna") {
            node.children[i] = toLunaCode(child);
        } else {
            walk(child);
        }
    }
}

function toLunaCode(node) {
    const attributes = [
        // Plain-string value compiles to a JS string literal, so newlines/quotes
        // in the source are escaped for us.
        { type: "mdxJsxAttribute", name: "code", value: node.value },
    ];
    const match = node.meta && node.meta.match(TITLE);
    const title = match && (match[1] ?? match[2]);
    if (title) {
        attributes.push({
            type: "mdxJsxAttribute",
            name: "title",
            value: title,
        });
    }
    return {
        type: "mdxJsxFlowElement",
        name: "LunaCode",
        attributes,
        children: [],
    };
}
