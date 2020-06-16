# Specification hashes
- element not specified are considered 0
- `H` is the poseidon hash function
- The fields in the elements are stored as:
```
e_0: [ 16 bits ] bits e0[239:255]
     [ 16 bits ] bits e0[222:238]
     [ 160 bits] bits e0[61:221]
```
- if not specified, bits until fill the element are 0

## Account tree leaf
- leaf value information:
  - id
- leaf key information:
  - amount
  - token
  - ethereum address
  - nonce
  - Ax
  - Ay

```
Key = id
Value = H(e0, e1, e2, e3, e4)
```

```
e_0: [ 32 bits ] token
     [ 48 bits ] nonce
e_1: [ 253 bits] amount     
e_2: [ 253 bits] ax
e_3: [ 253 bits] ay
e_4: [ 160 bits] ethereum address
```

>Exit tree will have the same format

## Iden3 rollup transaction constant
```
const IDEN3_ROLLUP_TX = 4839017969649077913;
```

## Rollup Transaction
```
Tx: 
    fromAx
    fromAy
    fromEthAddr
    toAx
    toAy
    toEthAddr
    onChain
    newAccount
    coin
    amount
    nonce
    userFee
    r8x
    r8y
    s
```

where the following parameters are used exclusively off-chain:
`nonce`, `userFee`, `r8x`, `r8y`, `s`

## Signature
```
txData: [ 64 bits ] iden3_rollup_tx
        [ 16 bits ] amount
        [ 32 bits ] coin
        [ 48 bits ] nonce
        [ 16 bits ] userFee
        [ 3 bits  ] rqOffset
        [ 1 bits  ] onChain
        [ 1 bits  ] newAccount
```

```
messageToSign = H(e0, e1, e2, e3, e4)

e_0: [ 253 bits ] txData
e_1: [ 253 bits ] tx.rqTxData
e_2: [ 253 bits ] toAx
e_3: [ 253 bits ] toAy
e_4: [ 160 bits ] toEthAddr
```

## Off-chain data vailability / off-chain hash
It will hash all the off-chain transactions that are publicly available through smart contract `Rollup` at the time to forge a batch:
- maxTx: maximum number of transactions
- Off-chain Tx `offTx`:
``` 
[ 24  bits ] from
[ 24  bits ] to
[ 16  bits ] amount
[ 4  bits  ] fee
```
- On-chain Transaction `onTx`:
```
[ 24  bits ] 0
[ 24  bits ] 0
[ 16  bits ] 0
[ 4  bits  ] 0
```

Since implementations of sha256 must have an integer number of bytes, and every transaction has 8.5 bytes, in case MaxTx is odd, there's an additional padding of 4 bits to 0 at the start.

- Final hash off-chain:
```
hashOffChain = sha256( (maxTx % 2 ? 0000 : None) # onTx[0] # ... # onTx[numOnChain - 1] # offTx[0] # offTx[1] # ... # offTx[numOffChain - 1])
```

## On-chain tx hash
```
dataOnChain = H(e0, e1, e2, e3, e4)

e_0: [ 253 bits ] fromAx
e_1: [ 253 bits ] fromAy
e_2: [ 253 bits ] toEthAddr
e_3: [ 253 bits ] toAx
e_4: [ 253 bits ] toAy
```

```
nextOnChainHash = H(e0, e1, e2, e3, e4)

e_0: [ 253 bits ] oldOnChainHash
e_1: [ 253 bits ] txData
e_2: [ 253 bits ] load amount
e_3: [ 253 bits ] dataOnChain
e_4: [ 253 bits ] fromEthAddr
```

## Deposits off-chain data availability
- On-chain parameters structure `onChainParam`:
```
[ 32   bits ] coin
[ 160  bits ] fromEthAddr
[ 256  bits ] fromAy
[ 256  bits ] fromAx
```

- Final data availability:
```
onChainDataAvailability = onChainParam[0] # onChainParam[1] # ... # onChainParam[N - 1] # onChainParam[N]
```