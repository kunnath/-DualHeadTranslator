FROM node:20-slim

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Create data directory
RUN mkdir -p data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV PG_HOST=postgres
ENV PG_PORT=5432
ENV PG_DATABASE=translation_memory
ENV PG_USER=postgres
ENV PG_PASSWORD=postgres
ENV OLLAMA_HOST=http://ollama:11434
ENV OLLAMA_MODEL=deepseek-r1:8b

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 3000, path: '/', timeout: 2000 }; const req = http.request(options, (res) => { process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Start the application
CMD ["node", "server.js"]
