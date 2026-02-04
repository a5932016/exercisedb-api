# Use the official Bun image
FROM oven/bun:latest as base
WORKDIR /usr/src/app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Install production dependencies
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Build the application
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN bun run build

# Run the application
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=build /usr/src/app/dist dist
COPY --from=build /usr/src/app/package.json .
COPY --from=build /usr/src/app/src/data src/data
COPY --from=build /usr/src/app/media media

# Set environment variables
ENV NODE_ENV=production
# The app is configured to listen on port 80 in src/server.ts
EXPOSE 8090

USER bun
ENTRYPOINT [ "bun", "run", "start" ]
