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

## Balance tree leaf
- leaf value information:
  - id
- leaf key information:
  - amount
  - token
  - withdraw address
  - nonce
  - Ax
  - Ay

```
Key = id
Value = H(e0, e1, e2, e3)
```

```
e_0: [ 128 bits ] amount
     [ 16 bits  ] token
     [ 32 bits  ] nonce
e_1: [ 253 bits] Ax
e_2: [ 253 bits] Ay
e_3: [ 160 bits] withdraw address
```

## Exit tree leaf
- It has the same structure as the balance tree
- leaf value information:
  - id
- leaf key information:
  - amount
  - token
  - withdraw address
  - nonce
  - Ax
  - Ay

```
Key = id
Value = H(e0, e1, e2, e3)
```

```
e_0: [ 128 bits ] amount
     [ 16 bits  ] token
     [ 32 bits  ] nonce
e_1: [ 253 bits] Ax
e_2: [ 253 bits] Ay
e_3: [ 160 bits] withdraw address
```

## Off-chain tx hash
It will hash all the off-chain transactions that are publicly available through smart contract `Rollup` at the timne to forge a batch:
- maxTx: maximum number of transactions
- Tx_struct: 
  - [ 24  bits] from
    [ 24  bits] to
    [ 16  bits] amount
    [ 16  bits] coin
```
sha256(Tx_struct[0] # Tx_struct[1] # ... # Tx_struct[maxTx - 1])
```
In the case that there are less transactions than the maximum, those transactions are set to: [0, 0, 0, 0]

## On-chain tx hash
- on-chain tx information:
  - oldOnChainHash
  - transaction data
  - load amount
  - ethereum address ( used at this stage as `withdraw address` )
  - Ax
  - Ay

```
nextOnChainHash = H(e0, e1, e2, e3, e4, e5)
```

```
e_0: [ 253 bits] oldOnChainHash
e_1: [ 64 bits ] from
     [ 64 bits ] to
     [ 16 bits ] amount
     [ 16 bits ] coin
     [ 48 bits ] nonce
     [ 16 bits ] maxFee
     [ 4 bits  ] reqOffset
     [ 1 bit   ] flag on chain
     [ 1 bit   ] flag new account 
e_2: [ 253 bits] load amount
e_3: [ 253 bits] ethereum address
e_4: [ 253 bits] Ax
e_5: [ 253 bits] Ay
```