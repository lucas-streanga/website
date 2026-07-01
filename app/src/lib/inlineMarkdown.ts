// inlineMarkdown.ts
// Minimal inline-Markdown renderer for short strings like image captions.
// Supports links written as [text](url). Everything else is HTML-escaped, so
// the output is safe to pass to set:html and raw HTML in the source is shown
// literally rather than interpreted.

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function inlineMarkdown(input: string): string {
    let out = "";
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = LINK.exec(input)) !== null) {
        // Escaped text before this link.
        out += escapeHtml(input.slice(last, m.index));

        const text = escapeHtml(m[1]);
        const href = escapeHtml(m[2]);
        // Open external links in a new tab, with the security rel that pairs with it.
        const external = /^https?:\/\//.test(m[2]);
        const attrs = external
            ? ' target="_blank" rel="noopener noreferrer"'
            : "";
        out += `<a href="${href}"${attrs}>${text}</a>`;

        last = m.index + m[0].length;
    }

    // Remaining escaped text after the last link.
    out += escapeHtml(input.slice(last));
    return out;
}
