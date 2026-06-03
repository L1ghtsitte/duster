FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages ./packages
RUN npm ci 2>/dev/null || npm install
RUN npm run build --workspace=@duster/shared
RUN cd packages/server && npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY package.json ./
EXPOSE 3847
CMD ["sh", "-c", "cd packages/server && npx prisma db push && npm run db:seed && node dist/index.js"]
