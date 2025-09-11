FROM node:18-alpine

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    giflib-dev \
    fontconfig \
    ttf-dejavu

RUN apk add --no-cache cargo rust && \
    cargo install tectonic && \
    apk del cargo rust

ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p temp

EXPOSE 3000

CMD ["node", "server.js"]