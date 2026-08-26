FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY whatsapp_service.js ./

CMD ["node", "whatsapp_service.js"]