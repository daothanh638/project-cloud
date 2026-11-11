FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --production

COPY backend/ ./

EXPOSE 8080

ENV NODE_ENV=production

CMD ["node", "index.js"]