FROM node:22-slim

# Lighthouse's browser: Debian chromium is multi-arch (amd64 + arm64),
# unlike Google's chrome .deb. Pulls its own runtime deps.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation \
 && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /website/app

# deps layer: cached unless package.json changes (repo-root build context;
# cold-start seed only — day-to-day installs go via `exec astro npm install`)
COPY app/package*.json ./
RUN npm install

COPY app/ ./

EXPOSE 4321
CMD ["sh", "-c", "rm -f .astro/dev.json && exec node_modules/.bin/astro dev --host 0.0.0.0"]
