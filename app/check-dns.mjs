#!/usr/bin/env node
// Black-box check of the public DNS + edge routing for the live site. Everything
// here is asserted against the real Cloudflare edge, not against local config,
// because none of it lives in this repo: the records and redirect rules are
// dashboard state that can silently drift from what the site assumes.
//
//   node check-dns.mjs [--domain streanga.com] [--pages-project <name>] [--json] [-v]
//
// Exits 1 on any failure, 0 if only warnings. Safe to run in CI.
import http from "node:http";
import https from "node:https";

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : (argv[i + 1] ?? true);
};

const DOMAIN = flag("domain", "streanga.com");
const PAGES_PROJECT = flag("pages-project");
const JSON_OUT = argv.includes("--json");
const VERBOSE = argv.includes("-v") || argv.includes("--verbose");

const CANONICAL = `https://${DOMAIN}`;
const WWW = `www.${DOMAIN}`;
const TIMEOUT = 10_000;
const HOP_LIMIT = 5;
const UA = "check-dns.mjs (+https://github.com/)";

// Many sandboxes (this project's container included) have no IPv6 route, so an
// AAAA-first connect fails with ENETUNREACH even though the record is healthy.
// Pin the socket to v4 and probe IPv6 at the DNS layer instead.
const FAMILY = 4;

// ---------------------------------------------------------------- primitives

class Warning extends Error {}
const warn = (msg) => {
    throw new Warning(msg);
};

// Resolve zone hostnames through DoH rather than the system resolver. A local
// resolver that negatively cached NXDOMAIN for a name you just created will
// report failure long after the record is live, which is exactly the false
// negative this script exists to rule out.
const dohAddrs = new Map();
async function resolveViaDoh(hostname) {
    if (!dohAddrs.has(hostname)) {
        const { answers } = await doh(hostname, "A");
        const ips = answers.filter((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
        if (ips.length === 0) throw new Error(`no A record for ${hostname}`);
        dohAddrs.set(hostname, ips[0]);
    }
    return dohAddrs.get(hostname);
}

function request(
    url,
    { wantBody = false, headers = {}, systemDns = false } = {},
) {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? https : http;
    // cloudflare-dns.com must use the system resolver or resolveViaDoh recurses.
    const inZone = !systemDns && u.hostname.endsWith(DOMAIN);
    const lookup = inZone
        ? (hostname, _opts, cb) =>
              resolveViaDoh(hostname).then(
                  (ip) => cb(null, ip, 4),
                  (err) => cb(err),
              )
        : undefined;
    return new Promise((resolve, reject) => {
        const req = mod.request(
            {
                protocol: u.protocol,
                hostname: u.hostname,
                path: u.pathname + u.search,
                method: "GET",
                family: FAMILY,
                lookup,
                headers: {
                    Host: u.host,
                    "User-Agent": UA,
                    Accept: "*/*",
                    ...headers,
                },
            },
            (res) => {
                if (!wantBody) {
                    res.resume();
                    resolve({ status: res.statusCode, headers: res.headers });
                    return;
                }
                let body = "";
                res.setEncoding("utf8");
                res.on("data", (c) => (body += c));
                res.on("end", () =>
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body,
                    }),
                );
            },
        );
        req.setTimeout(TIMEOUT, () =>
            req.destroy(new Error(`timeout after ${TIMEOUT}ms`)),
        );
        req.on("error", reject);
        req.end();
    });
}

// Manual redirect following: the hop list itself is what we assert on (count,
// status codes, and that no hop leaks http:// or the www host).
async function chain(startUrl) {
    const hops = [];
    let url = startUrl;
    for (let i = 0; i <= HOP_LIMIT; i++) {
        const res = await request(url, { wantBody: false });
        const location = res.headers.location ?? null;
        hops.push({ url, status: res.status, location });
        const redirecting = res.status >= 300 && res.status < 400 && location;
        if (!redirecting) {
            return {
                hops,
                final: url,
                status: res.status,
                headers: res.headers,
            };
        }
        url = new URL(location, url).toString();
    }
    throw new Error(
        `redirect loop (>${HOP_LIMIT} hops) starting at ${startUrl}`,
    );
}

async function doh(name, type) {
    const res = await request(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
        {
            wantBody: true,
            systemDns: true,
            headers: { Accept: "application/dns-json" },
        },
    );
    const json = JSON.parse(res.body);
    // NOERROR with no Answer section is NODATA: the name exists in the zone but
    // has no record of this type. NXDOMAIN (3) means the name does not exist.
    return {
        status: json.Status,
        answers: (json.Answer ?? [])
            .filter((a) => a.type !== 5 || type === "CNAME")
            .map((a) => a.data),
        all: (json.Answer ?? []).map((a) => a.data),
    };
}

// ------------------------------------------------------------- test harness

const results = [];
let currentSection = "";
const section = (name) => (currentSection = name);

async function check(name, fn) {
    const section = currentSection;
    try {
        const detail = await fn();
        results.push({ section, name, status: "pass", detail: detail ?? "" });
    } catch (err) {
        results.push({
            section,
            name,
            status: err instanceof Warning ? "warn" : "fail",
            detail: err.message,
        });
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

// ------------------------------------------------------------------- checks

async function dnsChecks() {
    section("dns");

    await check(`${DOMAIN} resolves to proxied Cloudflare IPs`, async () => {
        const v4 = await doh(DOMAIN, "A");
        const v6 = await doh(DOMAIN, "AAAA");
        assert(v4.answers.length > 0, "no A record");
        assert(
            v6.answers.length > 0,
            "no AAAA record (IPv6-only clients fail)",
        );
        // Unproxied would expose the origin; every proxied answer is in Cloudflare space.
        const proxied = v6.answers.every((ip) => ip.startsWith("2606:4700"));
        assert(
            proxied,
            `AAAA not on Cloudflare edge: ${v6.answers.join(", ")}`,
        );
        return `A ${v4.answers.join(", ")} | AAAA ${v6.answers.join(", ")}`;
    });

    await check(`${WWW} resolves`, async () => {
        const v4 = await doh(WWW, "A");
        const v6 = await doh(WWW, "AAAA");
        const cname = await doh(WWW, "CNAME");
        assert(
            v4.answers.length > 0 || v6.answers.length > 0,
            "NODATA: no A/AAAA/CNAME for www, so it cannot be reached at all",
        );
        const via = cname.answers.length ? ` (CNAME ${cname.answers[0]})` : "";
        return `A ${v4.answers.join(", ") || "none"} | AAAA ${v6.answers.join(", ") || "none"}${via}`;
    });

    await check("nameservers are Cloudflare", async () => {
        const ns = await doh(DOMAIN, "NS");
        assert(ns.answers.length > 0, "no NS records");
        const cf = ns.answers.every((n) => n.includes("ns.cloudflare.com"));
        assert(
            cf,
            `not fully delegated to Cloudflare: ${ns.answers.join(", ")}`,
        );
        return ns.answers.join(", ");
    });

    await check("CAA records restrict issuance", async () => {
        const caa = await doh(DOMAIN, "CAA");
        if (caa.answers.length === 0) {
            warn("no CAA records: any CA may issue for this domain");
        }
        return caa.answers.join(" | ");
    });

    await check("DNSSEC is enabled", async () => {
        const ds = await doh(DOMAIN, "DS");
        if (ds.answers.length === 0) warn("no DS record at the registrar");
        return ds.answers.join(" | ");
    });
}

// A botched www edit is an easy way to also wipe mail routing, and nothing else
// in this repo would notice. Cheap to assert, expensive to discover by bounce.
async function emailChecks() {
    section("email");

    await check("MX records present", async () => {
        const mx = await doh(DOMAIN, "MX");
        assert(mx.answers.length > 0, "no MX records: inbound mail is dead");
        return mx.answers.join(" | ");
    });

    await check("SPF record present", async () => {
        const txt = await doh(DOMAIN, "TXT");
        const spf = txt.answers.filter((t) => t.includes("v=spf1"));
        assert(spf.length > 0, "no v=spf1 TXT record");
        assert(
            spf.length === 1,
            `${spf.length} SPF records (must be exactly 1)`,
        );
        return spf[0];
    });

    await check("DMARC record present", async () => {
        const txt = await doh(`_dmarc.${DOMAIN}`, "TXT");
        const dmarc = txt.answers.filter((t) => t.includes("v=DMARC1"));
        if (dmarc.length === 0) warn("no _dmarc TXT record");
        return dmarc[0] ?? "";
    });
}

// The redirect matrix. Every non-canonical entry point, across a set of paths
// chosen to catch the things redirect rules actually get wrong.
const PATHS = [
    "/",
    "/blog",
    "/blog/",
    "/?utm_source=newsletter&ref=a%20b",
    "/blog?q=hello%20world&page=2",
];

// A real deep URL from the sitemap, so the deep-path case asserts a 200 rather
// than a 404 from a slug that was only ever a guess.
async function deepPath() {
    try {
        const res = await request(`${CANONICAL}/sitemap-0.xml`, {
            wantBody: true,
        });
        const urls = [...res.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
            (m) => new URL(m[1]).pathname,
        );
        return (
            urls.find((p) => p.split("/").filter(Boolean).length > 1) ?? null
        );
    } catch {
        return null;
    }
}

// Trailing-slash normalisation is the host's business, not the redirect's, so
// compare paths modulo a single trailing slash. Query strings are compared
// exactly: dropping them is the classic Cloudflare redirect-rule bug.
const samePath = (a, b) => a.replace(/\/$/, "") === b.replace(/\/$/, "");

async function redirectChecks() {
    section("redirects");

    const deep = await deepPath();
    const paths = deep ? [...PATHS, deep, `${deep}?utm_source=x`] : PATHS;

    for (const origin of [
        `http://${DOMAIN}`,
        `http://${WWW}`,
        `https://${WWW}`,
    ]) {
        for (const path of paths) {
            const start = origin + path;
            await check(`${start}`, async () => {
                const { hops, final, status } = await chain(start);
                const want = new URL(path, CANONICAL);
                const got = new URL(final);

                assert(
                    hops.length > 1,
                    `no redirect issued (served ${status} directly from a non-canonical origin)`,
                );
                assert(
                    got.protocol === "https:",
                    `ended on ${got.protocol} instead of https`,
                );
                assert(
                    got.host === DOMAIN,
                    `ended on host ${got.host} instead of ${DOMAIN}`,
                );
                assert(
                    samePath(got.pathname, want.pathname),
                    `path not preserved: wanted ${want.pathname}, got ${got.pathname}`,
                );
                assert(
                    got.search === want.search,
                    `query string not preserved: wanted "${want.search || "(none)"}", got "${got.search || "(none)"}". ` +
                        `Tick "preserve query string" on the redirect rule, or build the target from ` +
                        `http.request.uri (which includes the query) rather than http.request.uri.path.`,
                );
                assert(status === 200, `final response was ${status}, not 200`);

                // Only the scheme/host hops are ours to get right. A 308 from
                // the canonical origin is Astro's trailing-slash normalisation
                // and is expected, so asserting 301 across every hop is noise.
                const canonicalising = hops
                    .slice(0, -1)
                    .filter(
                        (h) =>
                            new URL(h.url).host !== DOMAIN ||
                            new URL(h.url).protocol === "http:",
                    );
                const wrong = canonicalising.filter((h) => h.status !== 301);
                if (wrong.length > 0) {
                    warn(
                        `canonicalising hop returned ${wrong.map((h) => h.status).join(", ")}; ` +
                            `301 is the permanent code search engines consolidate on`,
                    );
                }
                if (hops.length > 3) {
                    warn(
                        `${hops.length - 1} redirect hops: ${hops.map((h) => h.url).join(" -> ")}`,
                    );
                }
                return hops.map((h) => `${h.status} ${h.url}`).join(" -> ");
            });
        }
    }

    await check(`${CANONICAL}/ serves directly (no redirect)`, async () => {
        const { hops, status } = await chain(`${CANONICAL}/`);
        assert(status === 200, `got ${status}`);
        assert(
            hops.length === 1,
            `canonical origin redirects: ${hops.map((h) => h.url).join(" -> ")}`,
        );
        return "200, zero hops";
    });
}

async function edgeChecks() {
    section("edge");

    await check("HSTS header on canonical origin", async () => {
        const res = await request(`${CANONICAL}/`);
        const hsts = res.headers["strict-transport-security"];
        assert(hsts, "no Strict-Transport-Security header");
        const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);
        assert(maxAge >= 31_536_000, `max-age=${maxAge} is under one year`);
        if (!/includesubdomains/i.test(hsts)) {
            warn(
                `missing includeSubDomains, so ${WWW} is not covered: ${hsts}`,
            );
        }
        return hsts;
    });

    await check("security headers on canonical origin", async () => {
        const res = await request(`${CANONICAL}/`);
        // Mirrors what csp-headers.mjs writes into dist/_headers at build time;
        // this asserts Pages actually applied the file.
        const required = [
            "content-security-policy",
            "x-content-type-options",
            "referrer-policy",
            "x-frame-options",
            "permissions-policy",
        ];
        const missing = required.filter((h) => !res.headers[h]);
        assert(
            missing.length === 0,
            `missing ${missing.join(", ")} (is dist/_headers being deployed?)`,
        );
        return required.join(", ");
    });

    await check("unknown path returns a real 404", async () => {
        const res = await request(`${CANONICAL}/definitely-not-a-page-9f3a`);
        assert(
            res.status === 404,
            `got ${res.status}: soft 404s let dead URLs stay indexed`,
        );
        return "404";
    });

    for (const path of ["/robots.txt", "/sitemap-index.xml", "/rss.xml"]) {
        await check(`${path} is reachable`, async () => {
            const res = await request(CANONICAL + path, { wantBody: true });
            assert(res.status === 200, `got ${res.status}`);
            // A sitemap advertising the www host would undo the canonicalisation.
            if (res.body.includes(WWW)) {
                warn(
                    `body references ${WWW}; check astro.config.mjs site setting`,
                );
            }
            return `200, ${res.body.length} bytes`;
        });
    }

    await check("TLS certificate covers both hostnames", async () => {
        const ip = await resolveViaDoh(WWW);
        const peer = await new Promise((resolve, reject) => {
            const req = https.request(
                {
                    hostname: WWW,
                    path: "/",
                    method: "HEAD",
                    family: FAMILY,
                    lookup: (_h, _o, cb) => cb(null, ip, 4),
                },
                (res) => {
                    resolve(res.socket.getPeerCertificate());
                    res.resume();
                },
            );
            req.on("error", reject);
            req.end();
        });
        const names = (peer.subjectaltname ?? "")
            .split(", ")
            .map((s) => s.replace(/^DNS:/, ""));
        const covers = (h) =>
            names.includes(h) ||
            names.includes(`*.${h.split(".").slice(1).join(".")}`);
        assert(covers(WWW), `cert does not cover ${WWW}: ${names.join(", ")}`);
        const daysLeft = Math.round(
            (Date.parse(peer.valid_to) - Date.now()) / 86_400_000,
        );
        if (daysLeft < 21) warn(`certificate expires in ${daysLeft} days`);
        return `${names.join(", ")} (expires in ${daysLeft}d)`;
    });
}

// The *.pages.dev hostname serves the same build and is publicly reachable, so
// it competes with the canonical domain in search results unless it is blocked.
async function pagesDevCheck() {
    if (!PAGES_PROJECT) return;
    section("pages.dev");
    await check(`${PAGES_PROJECT}.pages.dev is not indexable`, async () => {
        const res = await request(`https://${PAGES_PROJECT}.pages.dev/`, {
            wantBody: true,
        });
        const blocked =
            res.status >= 300 ||
            /noindex/i.test(res.headers["x-robots-tag"] ?? "");
        assert(
            blocked,
            `serves ${res.status} with no noindex: duplicate content competing with ${DOMAIN}`,
        );
        return `${res.status} ${res.headers["x-robots-tag"] ?? ""}`.trim();
    });
}

// ------------------------------------------------------------------- report

async function main() {
    await dnsChecks();
    await emailChecks();
    await redirectChecks();
    await edgeChecks();
    await pagesDevCheck();

    const failed = results.filter((r) => r.status === "fail");
    const warned = results.filter((r) => r.status === "warn");

    if (JSON_OUT) {
        console.log(
            JSON.stringify(
                {
                    domain: DOMAIN,
                    results,
                    failed: failed.length,
                    warned: warned.length,
                },
                null,
                2,
            ),
        );
    } else {
        const mark = {
            pass: "\x1b[32mPASS\x1b[0m",
            warn: "\x1b[33mWARN\x1b[0m",
            fail: "\x1b[31mFAIL\x1b[0m",
        };
        let last = "";
        for (const r of results) {
            if (r.section !== last) {
                console.log(`\n\x1b[1m[${r.section}]\x1b[0m`);
                last = r.section;
            }
            console.log(`  ${mark[r.status]}  ${r.name}`);
            if (r.detail && (VERBOSE || r.status !== "pass")) {
                console.log(`        ${r.detail}`);
            }
        }
        console.log(
            `\n${results.length} checks: ${results.length - failed.length - warned.length} passed, ` +
                `${warned.length} warned, ${failed.length} failed`,
        );
    }

    process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error(`check-dns: ${err.stack ?? err.message}`);
    process.exit(2);
});
