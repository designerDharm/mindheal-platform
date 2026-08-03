FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose the API port
EXPOSE 4000

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
