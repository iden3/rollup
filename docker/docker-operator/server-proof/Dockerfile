FROM node:10

RUN git clone https://github.com/iden3/rollup.git
WORKDIR "./rollup"
RUN npm install 
WORKDIR "./rollup-operator/src"

CMD ["sh","-c","node server-proof.js $PROOF_TIME"]