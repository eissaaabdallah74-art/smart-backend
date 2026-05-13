const ZKLib = require("node-zklib");
const zk = new ZKLib('127.0.0.1', 4370);
console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(zk)));
