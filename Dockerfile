# syntax=docker/dockerfile:1

# ---- Stage 1: install all dependencies (includes build tools) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build frontend assets + backend bundle ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- Stage 3: production dependencies only ----
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 4: minimal runtime ----
# The esbuild bundle keeps node_modules external, so the production
# dependency tree must be present at runtime next to dist/server.cjs.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Writable storage for uploaded digital surrogate copies (bind-mounted volume in compose)
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
EXPOSE 3031
USER node
CMD ["node", "dist/server.cjs"]
