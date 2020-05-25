// Set maximum fee to charge
const topValueFee = 0.5;

// Set division steps
const divStep = new Array(14).fill(0);
divStep[13] = 2.5;
divStep[12] = 2;
divStep[11] = 2;
divStep[10] = 2.5;
divStep[9] = 2;
divStep[8] = 2;
divStep[7] = 2.5;
divStep[6] = 2;
divStep[5] = 2;
divStep[4] = 2.5;
divStep[3] = 2;
divStep[2] = 2;
divStep[1] = 2.5;
divStep[0] = 2;


const table = new Array(16).fill(0);

// Compute fee inverse table
table[15] = 1 / topValueFee;
for (let i = table.length - 2; i > 0; i--){
    table[i] = table[i+1] * divStep[i-1];
}

// Compute % fee table
const tablePercentage = new Array(16).fill(0);
tablePercentage[0] = "0%";
for (let i = 1; i < table.length; i++){
    tablePercentage[i] = `${((1 / table[i]) * 100).toString()}%`;
}

// Compute decimal fee table
const tableDecimal = new Array(16).fill(0);
tableDecimal[0] = 0;
for (let i = 1; i < table.length; i++){
    tableDecimal[i] = 1 / table[i];
}

// Compute decimal fee table
const adjustedTable = new Array(16).fill(0);
for (let i = 0; i < tableDecimal.length; i++){
    adjustedTable[i] = tableDecimal[i] * 2**32;
}

// Compute decimal fee table
const realFee = new Array(16).fill(0);
for (let i = 0; i < tableDecimal.length; i++){
    realFee[i] = (adjustedTable[i] / 2**32) * 100;
}

// console.log(table);
console.log("tablePercentage: ", tablePercentage);
console.log("tableDecimal: ", tableDecimal);

console.log("AdjustedTable: ", adjustedTable);
console.log("RealFee: ", realFee);