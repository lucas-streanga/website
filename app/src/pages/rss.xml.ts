import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

// Blog feed at /rss.xml. Auto-discovered via the <link rel="alternate"> in
// BaseLayout's head. `context.site` comes from `site` in astro.config.mjs.
export async function GET(context: APIContext) {
    const posts = (await getCollection("blog")).sort(
        (a, b) => b.data.date.getTime() - a.data.date.getTime(),
    );
    return rss({
        title: "streanga.com · Blog",
        description: "Notes on building things, by Lucas.",
        site: context.site!,
        items: posts.map((post) => ({
            title: post.data.title,
            pubDate: post.data.date,
            description: post.data.description,
            link: `/blog/${post.id}/`,
        })),
    });
}
