const { babyJub } = require('circomlib');
const { Scalar } = require('ffjavascript');

function pointHexToCompress(pointHex) {
    if (!pointHex[0].startsWith('0x')) {
        pointHex[0] = `0x${pointHex[0]}`;
    }
    if (!pointHex[1].startsWith('0x')) {
        pointHex[1] = `0x${pointHex[1]}`;
    }
    const point = [
        Scalar.e(pointHex[0]), Scalar.e(pointHex[1]),
    ];
    const buf = babyJub.packPoint(point);

    return buf.toString('hex');
}

function hexToPoint(compress) {
    let compressHex;
    if (compress.startsWith('0x')) compressHex = compress.slice(2);
    else compressHex = compress;
    const buf = Buffer.from(compressHex, 'hex');
    const point = babyJub.unpackPoint(buf);
    const pointHexAx = `0x${point[0].toString(16)}`;
    const pointHexAy = `0x${point[1].toString(16)}`;
    const pointHex = [pointHexAx, pointHexAy];

    return pointHex;
}

module.exports = {
    pointHexToCompress,
    hexToPoint,
};
