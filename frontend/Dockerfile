# Build stage
FROM node:22-slim AS build

WORKDIR /app/frontend

COPY package*.json ./
RUN npm install

COPY . .
# Set build-time variables if needed
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Add nginx config if needed (optional)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
