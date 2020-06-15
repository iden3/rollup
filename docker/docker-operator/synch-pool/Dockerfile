FROM node:10
ARG branch=master
RUN git clone https://github.com/iden3/rollup.git
RUN mkdir table-conversion

# Download and install dependencies
WORKDIR /rollup
RUN git checkout $branch
RUN npm install
WORKDIR /rollup/rollup-operator/src
RUN npm install
WORKDIR /rollup

# Build configuration files
COPY config-pool/* ./
RUN node build-config.js
RUN ./create-config-env.sh
RUN mv config.env ./rollup-operator/src/synch-pool-service/

CMD ["sh", "-c", "node rollup-operator/src/synch-pool-service/run-synch-pool --clear $CLEAR_DB"]