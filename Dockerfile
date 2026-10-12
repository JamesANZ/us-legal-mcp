# Serves this stdio MCP server as Streamable-style HTTP on port 3000.
# The image has no published host port. The Omni gateway is the only process
# a client connects to. /readyz is up after the stdio session has initialized.
FROM node:22.17-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22.17-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    MCP_ENTRY=dist/index.js

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY http-bridge.mjs ./http-bridge.mjs

USER node

EXPOSE 3000

CMD ["node", "http-bridge.mjs"]
