FROM node:22-slim AS base

ENV NPM_CONFIG_LOGLEVEL=warn

WORKDIR /app

# vinext (the Next.js-on-Vite CLI this app builds/runs with) is a
# devDependency, not a normal dependency, so this `npm ci` must run before
# NODE_ENV is set to "production" -- npm's `omit=dev` config defaults to
# true under NODE_ENV=production, which would silently drop vinext and
# break both the build and `npm start` below.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so
# they must be passed as build args (Railway auto-fills any ARG whose name
# matches a service variable) rather than only set at runtime.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app
USER appuser

# PORT is injected at runtime by platforms like Railway; 3000 is only the
# local-dev fallback (vinext's own default).
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start"]
