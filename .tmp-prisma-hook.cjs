const fs = require("fs");
const childProcess = require("child_process");
const originalFork = childProcess.fork;

childProcess.fork = function patchedFork(...args) {
  const child = originalFork.apply(this, args);
  const originalWrite = child.stdin.write.bind(child.stdin);
  child.stdin.write = (chunk, ...writeArgs) => {
    fs.appendFileSync("/tmp/prisma-generator-input.jsonl", String(chunk));
    return originalWrite(chunk, ...writeArgs);
  };
  return child;
};
