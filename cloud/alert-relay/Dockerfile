FROM node:24-bookworm-slim
WORKDIR /service
COPY app/alert-protocol.mjs app/alert-protocol.mjs
COPY cloud/alert-relay/server.mjs cloud/alert-relay/server.mjs
RUN mkdir -p /data && chown node:node /data
USER node
ENV PORT=8080 EGX_RELAY_BIND=0.0.0.0 EGX_RELAY_DATABASE=/data/relay.sqlite
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","cloud/alert-relay/server.mjs"]
