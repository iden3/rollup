const { createCodeError } = require("./walletsSend");


let counter0 = 0;
let counter1 = 0;
let counter2 = 0;
let counter3 = 0;
let counter4 = 0;
let counter5 = 0;
let counter6 = 0;
let counter7 = 0;
let counter8 = 0;
let counter9 = 0;
let counter10 = 0;
let counter11 = 0;
let iterations = 100000;

for (let i = 0; i < iterations; i++) {
    switch(createCodeError()){
    case 0:
        counter0++;
        break;
    case 1:
        counter1++;
        break;
    case 2:
        counter2++;
        break;
    case 3:
        counter3++;
        break;
    case 4:
        counter4++;
        break;
    case 5:
        counter5++;
        break;
    case 6:
        counter6++;
        break;
    case 7:
        counter7++;
        break;
    case 8:
        counter8++;
        break;
    case 9:
        counter9++;
        break;
    case 10:
        counter10++;
        break;
    case 11:
        counter11++;
        break;
    }
}
console.log(counter0/iterations,counter1/iterations,counter2/iterations,counter3/iterations,counter4/iterations,counter5/iterations,counter6/iterations,
    counter7/iterations,counter8/iterations,counter9/iterations, counter10/iterations, counter11/iterations);
