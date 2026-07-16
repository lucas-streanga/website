import type { CollectionEntry } from "astro:content";

// Single source of truth for the site owner's identity, used by the Person
// schema (home) and as the author of every BlogPosting. Keep the social URLs in
// sync with the footer.
const AUTHOR = {
    name: "Lucas Streanga",
    url: "https://streanga.com",
    jobTitle: "Web Developer",
    description:
        "Web developer who likes to experiment with new technologies and build things.",
    sameAs: [
        "https://github.com/lucas-streanga",
        "https://www.linkedin.com/in/lucas-streanga-1a16891ab/",
        "https://www.instagram.com/lucas_streanga/",
    ],
};

export function personSchema(imageUrl?: string): Record<string, unknown> {
    return {
        "@context": "https://schema.org",
        "@type": "Person",
        name: AUTHOR.name,
        url: AUTHOR.url,
        jobTitle: AUTHOR.jobTitle,
        description: AUTHOR.description,
        ...(imageUrl ? { image: imageUrl } : {}),
        sameAs: AUTHOR.sameAs,
    };
}

// Built entirely from the post's frontmatter (+ already-resolved absolute URLs)
// so the structured data can never drift from what's rendered on the page.
export function blogPostingSchema(
    post: CollectionEntry<"blog">,
    url: string,
    imageUrl: string,
): Record<string, unknown> {
    const published = post.data.date.toISOString();
    return {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.data.title,
        description: post.data.description,
        datePublished: published,
        dateModified: published,
        author: {
            "@type": "Person",
            name: AUTHOR.name,
            url: AUTHOR.url,
        },
        image: imageUrl,
        url,
        mainEntityOfPage: url,
        ...(post.data.tags.length ? { keywords: post.data.tags } : {}),
    };
}
