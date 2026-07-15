import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// One schema enforced across every post: add a field here and it's required (or
// optional) everywhere, type-checked in your editor.
const blog = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            date: z.coerce.date(), // accepts YYYY-MM-DD in frontmatter
            description: z.string(),
            tags: z.array(z.string()).default([]),
            cover: image(), // path relative to the post file, e.g. ./cover.png
            coverAlt: z.string().default(""),
            coverCaption: z.string().optional(), // visible caption / credit under the image
        }),
});

export const collections = { blog };
