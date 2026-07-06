FROM node:22-slim

# --- git + push plumbing ---
# ca-certificates: slim ships none; no HTTPS can verify TLS without it (your CA error).
# openssh-client:  for ssh remotes / agent-socket auth, cheap to have either way.
# gh:              credential broker; the host's gh config is bind-mounted read-only
#                  (compose), so pushes borrow the token gh already holds on the host.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates openssh-client curl \
 && mkdir -p -m 755 /etc/apt/keyrings \
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
 && apt-get install -y --no-install-recommends gh \
 && apt-get update \
 && apt-get purge -y curl && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /website/app

# deps layer: cached unless package.json changes (repo-root build context)
COPY app/package*.json ./
RUN npm install

COPY app/ ./

EXPOSE 4321
CMD ["npm", "run", "dev"]
