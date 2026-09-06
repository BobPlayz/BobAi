FROM node:22-alpine
WORKDIR /app
COPY src ./src
RUN npm install --global tsx@4.20.3
EXPOSE 6380
ENV NODE_ENV=production
ENV BOBREDIS_HOST=0.0.0.0
ENV BOBREDIS_PORT=6380
ENV BOBREDIS_AOF=/data/bobredis.aof
VOLUME ["/data"]
CMD ["tsx", "src/index.ts"]
