FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-cjk ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/studio/package.json packages/studio/package.json
RUN npm ci --ignore-scripts
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1536
ENV COMMUNITY_API_ORIGIN=http://api:4421
RUN npm run build:all && mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 4420
CMD ["npm", "run", "start", "-w", "@flowbar/gen-studio"]
