FROM node:10
ARG branch=master
RUN git clone https://github.com/iden3/rollup.git
WORKDIR /rollup
RUN git checkout $branch
RUN npm install
COPY config-cli-pob/* ./
RUN node build-config.js
RUN mv config.json ./cli-pob
RUN mv wallet.json ./cli-pob
WORKDIR "./cli-pob"

CMD ["sh", "-c", ""]