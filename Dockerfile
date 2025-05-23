# 1) Build rmapi from ddvk/rmapi main branch
FROM golang:1.23-alpine AS rmapi-builder
RUN apk add --no-cache git

WORKDIR /src
RUN git clone --depth 1 https://github.com/ddvk/rmapi.git . \
 && CGO_ENABLED=0 go build -o rmapi

# 2) Main Node/Puppeteer image
FROM node:20-slim

# Install Chromium (for Puppeteer), unzip, and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libgbm1 libx11-xcb1 libxcomposite1 libxdamage1 \
      libxrandr2 libnss3 libgtk-3-0 xdg-utils unzip \
    && rm -rf /var/lib/apt/lists/*

# Bring in the statically-built rmapi binary
COPY --from=rmapi-builder /src/rmapi /usr/local/bin/rmapi
RUN chmod +x /usr/local/bin/rmapi

# App setup
WORKDIR /app
COPY package*.json ./

# Skip Puppeteer’s Chromium download and point it at the distro binary
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install production deps only
RUN npm ci --omit=dev

# Copy the rest of your app source
COPY . .

# Create a non-root user and give ownership of app & config dir
RUN useradd -m -u 1001 nodeapp \
 && mkdir -p /home/nodeapp/.config \
 && chown -R nodeapp:nodeapp /app /home/nodeapp

USER nodeapp

# Configure where rmapi stores its token and persist it
ENV RMAPI_CONFIG=/home/nodeapp/.config/.rmapi
VOLUME ["/home/nodeapp/.config"]

# Expose and run
EXPOSE 3000
ENV PORT=3000
CMD ["npm","start"]

