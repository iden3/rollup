FROM node:10
RUN git clone https://github.com/iden3/rollup.git
WORKDIR "./rollup"
RUN npm install
COPY config-cli-pos/* ./
RUN node build-config.js
RUN mv config.json ./cli-pos
RUN mv wallet.json ./cli-pos
WORKDIR "./cli-pos"

CMD ["sh", "-c", ""]