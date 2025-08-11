FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm i --omit=dev

COPY server.mjs ./server.mjs
COPY public ./public

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.mjs"]
