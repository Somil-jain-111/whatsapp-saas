# ---- Build stage ----------------------------------------------------------
# Needs devDependencies (@nestjs/cli, typescript) to compile. None of this layer
# reaches the final image.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --no-audit --no-fund

COPY . .

# Source maps are stripped here rather than in the runtime stage: deleting files
# in a later layer does not shrink the image, it only masks them. Builder layers
# are discarded entirely, so cleaning here is what actually saves space.
RUN npm run build \
    && find dist -type f -name "*.map" -delete

# ---- Runtime stage --------------------------------------------------------
# Production dependencies plus compiled JS only: no source, no toolchain, no
# devDependencies.
FROM node:20-alpine

ARG DB_TYPE

WORKDIR /app

COPY package*.json ./

# `npm pkg delete scripts.prepare` drops the "husky install" hook, which would
# otherwise fail with exit 127 here: husky is a devDependency and --omit=dev
# skips it. Scripts stay enabled generally so bcrypt's native build still runs.
#
# typescript/ts-node are then removed: typeorm declares ts-node as an *optional*
# peer, which npm installs anyway, dragging in typescript (~20MB) — the largest
# package in the image. Both are only needed by the TypeORM CLI to read .ts
# entities/migrations. This app runs compiled JS with an explicit entities array,
# migrationsRun: false and synchronize: false, so neither loads at runtime.
#
# Everything is one RUN on purpose: deleting files in a later layer does not
# shrink the image, it only hides them.
RUN npm pkg delete scripts.prepare \
    && npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf node_modules/typescript node_modules/ts-node \
              node_modules/.bin/tsc node_modules/.bin/tsserver node_modules/.bin/ts-node \
    && find node_modules -type f "(" -name "*.d.ts" -o -name "*.map" -o -name "*.md" -o -name "*.markdown" -o -name ".npmignore" -o -name ".eslintrc*" -o -name ".prettierrc*" -o -name "tsconfig*.json" -o -name "*.tsbuildinfo" ")" -delete \
    && find node_modules -type d "(" -name "__tests__" -o -name ".github" -o -name "docs" -o -name "example" -o -name "examples" ")" -prune -exec rm -rf {} +

# Only the compiled application. dist/test is left behind in the builder.
COPY --chown=node:node --from=builder /app/dist/src ./dist/src

EXPOSE 4050

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4050}/api/v${API_VERSION:-1}/health/live" >/dev/null || exit 1

# NODE_ENV is intentionally not set here. It arrives via --env-file at run time
# and gates CloudWatch init, Swagger, and Joi's required-field rules, so pinning
# it in the image would silently change application behaviour.
CMD ["node", "dist/src/main.js"]
