/* global BigInt */

const { babyJub, poseidon } = require('circomlib');

export const readFile = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function (event) {
      resolve(JSON.parse(event.target.result));
    };
  });
};

export const pointHexToCompress = (pointHex) => {
  if (!pointHex[0].startsWith('0x')) {
    pointHex[0] = `0x${pointHex[0]}`;
  }
  if (!pointHex[1].startsWith('0x')) {
    pointHex[1] = `0x${pointHex[1]}`;
  }
  const point = [
    BigInt(pointHex[0]), BigInt(pointHex[1]),
  ];
  const buf = babyJub.packPoint(point);
  return buf.toString('hex');
};

export const pointToCompress = (point) => {
  const pointBigInt = [BigInt(point[0]), BigInt(point[1])];
  const buf = babyJub.packPoint(pointBigInt);
  const compress = `0x${buf.toString('hex')}`;
  return compress;
};

export const hexToPoint = (compress) => {
  let compressHex;
  if (compress.startsWith('0x')) compressHex = compress.slice(2);
  else compressHex = compress;
  const buf = Buffer.from(compressHex, 'hex');
  const point = babyJub.unpackPoint(buf);
  const pointHexAx = point[0].toString(16);
  const pointHexAy = point[1].toString(16);
  const pointHex = [pointHexAx, pointHexAy];
  return pointHex;
};

export const state2array = (amount, token, ax, ay, ethAddress, nonce) => {
  const data = BigInt(token).add(BigInt(nonce).shl(32));
  return [
    data,
    BigInt(amount),
    BigInt(`0x${ax}`),
    BigInt(`0x${ay}`),
    BigInt(ethAddress),
  ];
};

export const hashState = (st) => {
  const hash = poseidon.createHash(6, 8, 57);
  return hash(st);
};

export const getNullifier = async (wallet, info, contractRollup, batch) => {
  const ax = wallet.babyjubWallet.publicKey[0];
  const ay = wallet.babyjubWallet.publicKey[1];
  const exitEntry = state2array(info.data.state.amount, 0, ax.toString(16), ay.toString(16),
    wallet.ethWallet.address, 0);
  const valueExitTree = hashState(exitEntry);
  const exitRoot = await contractRollup.getExitRoot(batch);
  const nullifier = [];
  nullifier[0] = BigInt(exitRoot);
  nullifier[1] = valueExitTree;
  const hashNullifier = hashState(nullifier);
  const boolNullifier = await contractRollup.exitNullifier(hashNullifier.toString());
  return boolNullifier;
};
