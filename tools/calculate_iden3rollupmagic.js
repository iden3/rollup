
const Scalar = require("ffjavascript").Scalar;
var blake = require("blakejs");

const r = Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617");

const IDEN3_ROLLUP_TX = "IDEN3_ROLLUP_TX";

const h = blake.blake2bHex(IDEN3_ROLLUP_TX);

const n =  Scalar.mod(Scalar.fromString(h, 16), r);

console.log(n.toString());

// Result: 1625792389453394788515067275302403776356063435417596283072371667635754651289
