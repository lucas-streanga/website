// URL-safe slug for a tag, e.g. "Gen AI" -> "gen-ai". Used both to build the
// tag-page route params and the hrefs that link to them, so they always match.
export function tagSlug(tag: string): string {
    return tag
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
