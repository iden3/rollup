


function simulate(treeLevel, NUpdates) {
    const nodes = [];
    for (let i=0; i<NUpdates; i++) {
        doUpdate();
    }
    return nodes[0] ? nodes[0] : 0;

    function doUpdate() {
        const targetNode = Math.floor(Math.random()*(1<<treeLevel));
        updateLevel(treeLevel-1, targetNode);
    }

    function updateLevel(level, branch) {
        if (level == 0) {
            updateNode(0);
            return;
        }
        updateNode( (1 << level) + branch);
        updateLevel(level -1, branch >> 1);
    }

    function updateNode(n) {
        const l1 = getStep(n << 1);
        const l2 = getStep((n<< 1) + 1);
        const cur = getStep(n);
        nodes[n] = Math.max(Math.max(l1, l2) + 1, cur);
    }

    function getStep(n) {
        if (n > 1<<treeLevel) return 0;  // Last line is always 0;
        return nodes[n] ? nodes[n] : 0;
    }
}

const r = simulate(24, 2048);
console.log(r);
