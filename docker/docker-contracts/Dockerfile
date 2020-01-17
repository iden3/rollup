FROM node:10
ARG branch=master
RUN git clone https://github.com/iden3/rollup.git
WORKDIR "./rollup"
RUN git checkout $branch
RUN npm install
RUN npm install -g truffle
COPY ./config-contracts/* ./

CMD ["sh", "-c", "truffle compile && node deployment-script.js && cp synch-config.json ../config-contracts/ && cp pool-config.json ../config-contracts/ && cp wallet.json ../config-contracts/  "]