FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

# install bcrypt on ubuntu, this not work with same version of OSX
# so uninstall it and re-install again
RUN npm uninstall bcrypt

RUN npm install bcrypt

COPY . .

RUN npm run build

EXPOSE 8080

CMD ["npm", "run", "start"]
