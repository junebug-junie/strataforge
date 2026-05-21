FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_STRATA_API_BASE=/strataforge
ENV VITE_STRATA_API_BASE=$VITE_STRATA_API_BASE
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html/strataforge
RUN printf 'server {\n\
  listen 80;\n\
  location /strataforge/api/ {\n\
    proxy_pass http://strata-api:8787/api/;\n\
    proxy_set_header Host $host;\n\
    proxy_set_header X-Real-IP $remote_addr;\n\
  }\n\
  location /strataforge/ {\n\
    root /usr/share/nginx/html;\n\
    try_files $uri $uri/ /strataforge/index.html;\n\
  }\n\
  location = / {\n\
    return 302 /strataforge/;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
