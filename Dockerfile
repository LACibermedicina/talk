FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY scripts ./scripts
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
COPY db ./db
COPY public ./public
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node","src/start.js"]
