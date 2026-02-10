FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies for building
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the NestJS project
RUN npm run build


FROM node:18-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy compiled app and package files from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json /usr/src/app/package-lock.json ./

# Install only production dependencies for a smaller image
RUN npm ci --omit=dev

# Create non-root user
RUN addgroup -S nest && adduser -S nest -G nest
USER nest

# Expose application port
EXPOSE 3000

# PostgreSQL env vars will be injected by Coolify and read via process.env

CMD ["node", "dist/main.js"]
