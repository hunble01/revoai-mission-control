FROM node:22-alpine AS build

RUN apk add --no-cache openssl libc6-compat

WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

RUN npm install && npm -w apps/api install

COPY . .

# Ensure Prisma engines/client are generated during image build
RUN npm -w apps/api run prisma:generate
RUN npm -w apps/api run build

FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl libc6-compat

WORKDIR /workspace

COPY --from=build /workspace/package*.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api ./apps/api

WORKDIR /workspace/apps/api

ENV NODE_ENV=production
ENV PORT=3001

CMD sh -c "npx prisma migrate deploy --schema=prisma/schema.prisma && node dist/main"
