FROM node:10
ARG branch=master
RUN git clone https://github.com/iden3/rollup.git
RUN mkdir table-conversion
WORKDIR "./rollup"
RUN git checkout $branch
RUN npm install 
COPY config-operator/* ./
RUN node build-config.js
RUN ./create-config-env.sh
RUN mv pool-config.json ./rollup-operator/src/server/
RUN mv synch-config.json ./rollup-operator/src/server/
RUN mv wallet.json ./rollup-operator/src/server/
RUN mv config.env ./rollup-operator/src/server/

CMD ["sh","-c","node rollup-operator/src/server/operator.js --passphrase $PASSWORD --clear true"]
