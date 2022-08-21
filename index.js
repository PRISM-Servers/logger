const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const { EOL } = require("os");
const util = require("util");

/**
 * Example usage (redirects output of console.log & console.error to a file, stores it in memory (last 5 entries) and emits it)
 * ```
 * const logger = new Logger({
 *     types: ["log", "error"],
 *     log: {
 *         emit: true,
 *         memory: {history: 5},
 *         file: {
 *             dir: "./",
 *             timestamp: date => {
 *                 return `[${date.getUTCHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()} UTC] `;
 *             }
 *         }
 *     }
 * });
 * 
 * logger.on("error", msg => {
 *     //do something here, potentially try not to log it again and cause a stack overflow
 * });
 * 
 * logger.logs.error // contains last 5 console.error entries
 * ```
 */
class Logger extends EventEmitter {
    constructor({types, log} = {}) {
        super();

        this.logs = {};

        if (!types) throw new Error("Missing types");
        if (!log) throw new Error("Missing log");

        if (!Array.isArray(types)) throw new Error("types needs to be an array");
        if (types.length == 0) throw new Error("types are empty");
        if (Object.keys(log).length == 0) throw new Error("log is empty");

        if (log.file && !log.file.dir && typeof log.file.dir != "string") throw new Error("Invalid dir");
        if (log.memory && isNaN(log.memory.history)) throw new Error("Invalid memory history size");
        if (log.file && log.file.timestamp && typeof log.file.timestamp != "function") throw new Error("Invalid file timestamp");

        for (let item of types) {
            if (!["log", "warn", "error", "debug"].includes(item)) {
                throw new Error("Invalid type " + item + ", must be one of log, warn, error, debug");
            }
        }

        for (let key in log) {
            if (!["file", "memory", "emit"].includes(key)) {
                throw new Error("Invalid log " + key + ", must be one of file, memory, emit");
            }
        }

        for (let item of types) {
            if (console[item].modified) {
                throw new Error("Attempted to attach logger to console." + item + " multiple times");
            }

            const o = console[item];
            this.logs[item] = [];

            console[item] = (...args) => {
                o(...args);

                let str = "";

                for (const item of args) {
                    str += (typeof item == "object" || typeof item == "function" ? util.inspect(item) : item) + " ";
                }

                str = str.trim();

                if (log.file) {
                    let d = new Date();
                    let fn = `${item}_${d.getUTCFullYear()}_${d.getUTCMonth() + 1}_${d.getUTCDate()}.log`;
                    let res = path.resolve(log.file.dir, fn);
                    fs.appendFileSync(res, `${(log.file.timestamp ? log.file.timestamp(new Date()) : "")}${str}${EOL}`);
                }

                if (log.memory) {
                    this.logs[item].push({time: new Date(), message: str});

                    if (this.logs[item].length >= log.memory.history) {
                        this.logs[item].splice(0, this.logs[item].length - log.memory.history);
                    }
                }
                
                if (log.emit) this.emit(item, str);
            };

            console[item].modified = true;
        }
    }
}

module.exports = Logger;
