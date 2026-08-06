FROM node:24.19.0

WORKDIR /usr/src/app

RUN npm install -g pnpm@11.5.0

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 8080

CMD ["pnpm", "run", "start:prod"]
