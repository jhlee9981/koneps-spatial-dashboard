FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application source
COPY . .

# Expose port
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

# Start application
CMD ["node", "server.js"]
