FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/* \
 && git config --global --add safe.directory /website

WORKDIR /website/app

# deps layer: cached unless package.json changes (paths now repo-root-relative)
COPY app/package*.json ./
RUN npm install

COPY app/ ./

EXPOSE 4321
CMD ["npm", "run", "dev"]
