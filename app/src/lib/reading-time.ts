const WORDS_PER_MINUTE = 200;

// Estimate reading time (whole minutes, min 1) from a post's raw Markdown/MDX
// body. Code blocks, inline code, MDX imports and tags are stripped first —
// they're not prose, and a code-heavy dev post would otherwise over-count.
export function readingTime(body: string | undefined): number {
    const prose = (body ?? "")
        .replace(/^import\s.+$/gm, " ") // MDX import lines
        .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
        .replace(/`[^`]*`/g, " ") // inline code
        .replace(/<[^>]+>/g, " "); // HTML / JSX tags
    const words = prose.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
