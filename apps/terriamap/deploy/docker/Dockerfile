# Docker image for the primary terria map application server
FROM node:24

RUN mkdir -p /usr/src/app && mkdir -p /etc/config/client
WORKDIR /usr/src/app/component
COPY . /usr/src/app
# RER deployment mounts the client config externally (k8s-style config mount)
RUN rm wwwroot/config.json && ln -s /etc/config/client/config.json wwwroot/config.json

EXPOSE 3001
ENV NODE_ENV=production
CMD [ "node", "./node_modules/terriajs-server/lib/app.js", "--config-file", "serverconfig.json" ]
