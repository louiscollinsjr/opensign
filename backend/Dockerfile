FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --production

COPY src ./src
COPY .env.example ./

EXPOSE 3000
CMD ["npm", "start"]
