  FROM node:22-slim

  # Lighthouse's browser: Debian chromium is multi-arch (amd64 + arm64),
  # unlike Google's chrome .deb. Pulls its own runtime deps.
  # git/ca-certificates: for the Claude Code service — Claude shells out to git a lot.
  RUN apt-get update \
   && apt-get install -y --no-install-recommends \
        chromium fonts-liberation \
        git ca-certificates \
        wl-clipboard \
    && rm -rf /var/lib/apt/lists/*
  ENV CHROME_PATH=/usr/bin/chromium

  # --- Claude Code -----------------------------------------------------------------
  # Used only by the `claude` compose service; completely inert for the astro service.
  # npm pulls the native linux-arm64 binary via an optional dep — the SAME binary on any
  # distro. It's 16K-page-safe (the Fedora sandbox smoke-tests the identical binary) and
  # node:22-slim already runs on this Asahi 16K host, so Debian + Claude is fine.
  # Placed ABOVE the app-deps layer so app/package.json churn never busts these layers.
  ENV DISABLE_AUTOUPDATER=1
  RUN npm install -g @anthropic-ai/claude-code \
   && claude --version                       # loud BUILD failure if it ever regresses on 16K

  # Stable machine-id: Claude fingerprints the device partly from /etc/machine-id;
  # without a fixed one it thinks it's a new machine each run and forces re-login.
  RUN printf '%s\n' "0123456789abcdef0123456789abcdef" > /etc/machine-id

  # Pre-create the config dir owned by the uid-1000 `node` user, so the `claude` service
  # (user: node + keep-id) can write auth into the named volume that mounts here — a fresh
  # named volume seeds its ownership from this path, which is what makes writes work.
  RUN mkdir -p /home/node/.claude && chown node:node /home/node/.claude
  # ---------------------------------------------------------------------------------

  WORKDIR /website/app

  # deps layer: cached unless package.json changes (repo-root build context;
  # cold-start seed only — day-to-day installs go via `exec astro npm install`)
  COPY app/package*.json ./
  RUN npm install

  COPY app/ ./

  EXPOSE 4321
  CMD ["sh", "-c", "rm -f .astro/dev.json && exec node_modules/.bin/astro dev --host 0.0.0.0"]
