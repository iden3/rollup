FROM node:10
ARG branch=master
RUN npm install -g browserify
RUN git clone https://github.com/iden3/rollup.git
WORKDIR "./rollup"
RUN git checkout $branch
RUN npm install
RUN npm run build:webapp
COPY config-webapp/config.json ./
RUN mv config.json ./simple-webapp/src/utils
WORKDIR "./simple-webapp"
RUN npm install

CMD ["npm", "start"]