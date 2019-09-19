const process = require('child_process');
const chai = require('chai');

const { expect } = chai;

describe("CLI", async () => {
  const ls = await process.spawn('node', ['../', 'cli-laia.js', 'printkeys' ]);
  
  ls.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });
  ls.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
  
  ls.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
})