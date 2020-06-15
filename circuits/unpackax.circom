include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/pointbits.circom";

template UnpackAx() {
    signal input Ax;
    signal output Ay;

    var tmpAx = Ax;
    var tmpAy = 0;

    var a = 168700;
    var d = 168696;

    var x2 = tmpAx*tmpAx;
    var y = sqrt((a*x2 - 1)/(d*x2 - 1));

    var negy = -y;

    if (inSubgroup(tmpAx, y)){ 
        tmpAy = y;
    } else if (inSubgroup(tmpAx, negy)){
        tmpAy = negy;
    }

    Ay <-- tmpAy; 
}

function inCurve(x, y) {
    var a = 168700;
    var d = 168696;
    
    var x2 = x*x;
    var y2 = y*y;

    var leftSide = a*x2 + y2;
    var rigthSide = 1 + d*x2*y2;

    var ret = 0;

    if (leftSide == rigthSide) {
        ret = 1;
    } 
    return ret;
}

function addPoint(x1, y1, x2, y2) {
    var a = 168700;
    var d = 168696;

    var beta;
    var gamma;
    var delta;
    var tau;

    beta = x1*y2;
    gamma = y1*x2;
    delta = (-a*x1+y1)*(x2 + y2);
    tau = beta * gamma;

    var xout = (beta + gamma) / (1+ d*tau);
    var yout = (delta + a*beta - gamma) / (1-d*tau);
    
    return [xout, yout];
}

function mulPointEscalar(base, e) {
    var res[2] = [0, 1];
    var rem = e;
    var exp[2] = base;

    while (rem != 0) {
        if ((rem & 1) == 1) {
            res = addPoint(res[0], res[1], exp[0], exp[1]);
        }
        exp = addPoint(exp[0], exp[1], exp[0], exp[1]);
        rem = rem >> 1;
    }
    return res;
}

function inSubgroup(x, y) {
    var ret = 0;
    
    if (inCurve(x, y) == 0) {
        return ret;
    } 
    
    var subOrder = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

    var res[2] = mulPointEscalar([x, y], subOrder);
    
    if ((res[0] == 0) && (res[1] == 1)) {
        ret = 1;
    }
    return ret;
}