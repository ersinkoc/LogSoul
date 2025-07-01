FROM node:18-alpine

# Install dependencies for better performance
RUN apk add --no-cache python3 make g++ sqlite

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create a non-root user
RUN addgroup -g 1001 -S logsoul && \
    adduser -S logsoul -u 1001

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data && \
    chown -R logsoul:logsoul /app /usr/src/app

# Switch to non-root user
USER logsoul

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/domains || exit 1

# Default command
CMD ["node", "dist/src/index.js"]