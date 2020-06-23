/* global BigInt */

const { babyJub, poseidon } = require('circomlib');

const web3 = require('web3');
const { Scalar } = require('ffjavascript');

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
  let data = Scalar.e(0);

  data = Scalar.add(data, token);
  data = Scalar.add(data, Scalar.shl(nonce, 32));

  return [
    data,
    Scalar.e(amount),
    Scalar.fromString(ax, 16),
    Scalar.fromString(ay, 16),
    Scalar.fromString(ethAddress, 16),
  ];
};

export const hashState = (st) => {
  const hash = poseidon.createHash(6, 8, 57);
  return hash(st);
};

export const getNullifier = async (wallet, info, contractRollup, batch) => {
  const { ax } = wallet.babyjubWallet.public;
  const { ay } = wallet.babyjubWallet.public;
  const exitEntry = state2array(info.data.state.amount, info.data.state.coin, ax.toString(16), ay.toString(16),
    wallet.ethWallet.address, 0);
  const valueExitTree = hashState(exitEntry);
  const exitRoot = await contractRollup.getExitRoot(batch);
  const nullifier = [];
  nullifier[0] = valueExitTree;
  nullifier[1] = batch;
  nullifier[2] = BigInt(exitRoot);
  const hashNullifier = hashState(nullifier);
  const boolNullifier = await contractRollup.exitNullifier(hashNullifier.toString());
  return boolNullifier;
};

export const getWei = (ether) => {
  let wei;
  try {
    wei = web3.utils.toWei(ether, 'ether');
  } catch (err) {
    wei = '0';
  }
  return wei;
};

export const feeTable = {
  '0%': 0,
  '0.001%': 1,
  '0.002%': 2,
  '0.005%': 3,
  '0.01%': 4,
  '0.02%': 5,
  '0.05%': 6,
  '0.1%': 7,
  '0.2%': 8,
  '0.5%': 9,
  '1%': 10,
  '2%': 11,
  '5%': 12,
  '10%': 13,
  '20%': 14,
  '50%': 15,
};

export const feeTableDropdown = [
  {
    key: '0%',
    text: '0%',
    value: '0%',
  },
  {
    key: '0.001%',
    text: '0.001%',
    value: '0.001%',
  },
  {
    key: '0.002%',
    text: '0.002%',
    value: '0.002%',
  },
  {
    key: '0.005%',
    text: '0.005%',
    value: '0.005%',
  },
  {
    key: '0.01%',
    text: '0.01%',
    value: '0.01%',
  },
  {
    key: '0.02%',
    text: '0.02%',
    value: '0.02%',
  },
  {
    key: '0.05%',
    text: '0.05%',
    value: '0.05%',
  },
  {
    key: '0.1%',
    text: '0.1%',
    value: '0.1%',
  },
  {
    key: '0.2%',
    text: '0.2%',
    value: '0.2%',
  },
  {
    key: '0.5%',
    text: '0.5%',
    value: '0.5%',
  },
  {
    key: '1%',
    text: '1%',
    value: '1%',
  },
  {
    key: '2%',
    text: '2%',
    value: '2%',
  },
  {
    key: '5%',
    text: '5%',
    value: '5%',
  },
  {
    key: '10%',
    text: '10%',
    value: '10%',
  },
  {
    key: '20%',
    text: '20%',
    value: '20%',
  },
  {
    key: '50%',
    text: '50%',
    value: '50%',
  },
];

export const exitAx = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const exitAy = '0x0000000000000000000000000000000000000000000000000000000000000000';
