"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = exports.TokenType = void 0;
const process_1 = require("process");
var TokenType;
(function (TokenType) {
    TokenType["MATH"] = "math";
    TokenType["STACK"] = "stack";
    TokenType["CONTROL_FLOW"] = "control_flow";
    TokenType["FUNCTION"] = "function";
    TokenType["VARIABLE"] = "variable";
    TokenType["ARRAY"] = "array";
    TokenType["MISC"] = "misc";
})(TokenType = exports.TokenType || (exports.TokenType = {}));
function _readSplitNumber(instructions, startAddr, splits) {
    let number = 0, offset = 0;
    for (let i = splits - 1; i != -1; i--, offset++) {
        let n = instructions[startAddr + offset] << (8 * i);
        if (i == splits - 1)
            number = n;
        else
            number |= n;
    }
    return number;
}
class Token {
    constructor() {
        this.parameters = [];
    }
    static makeOpaque(transparent) {
        let token = new Token();
        token.name = transparent.name;
        token.configKey = transparent.configKey;
        token.opcode = transparent.opcode;
        token.address = transparent.address;
        token.argumentCount = transparent.argumentCount;
        token.parameterCount = transparent.parameterCount;
        token.variableArguments = transparent.variableArguments;
        token.type = transparent.type;
        return token;
    }
    get hasArguments() {
        return !!(this.argumentCount && this.parameterCount);
    }
    get isOpaque() {
        return true;
    }
    static tokenize(instructions, configuration) {
        let tokens = [];
        const knownInstructions = (() => {
            let _ki = [];
            let keys = Object.keys(configuration.instructions);
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                _ki[configuration.instructions[key].opcode] =
                    configuration.instructions[key];
            }
            return _ki;
        })();
        for (let address = 0; address < instructions.length; address++) {
            let instruction = instructions[address];
            if (knownInstructions[instruction] == null) {
                console.error(`Invalid instruction at address ${address}`);
                (0, process_1.exit)();
            }
            let token = this.makeOpaque(Object.assign({}, knownInstructions[instruction]));
            token.address = address;
            if (token.parameterCount != null)
                address +=
                    token.configKey == "PUSH_IMMEDIATE"
                        ? token.parsePIParameters(instructions)
                        : token.parseParameters(instructions);
            tokens.push(token);
        }
        return tokens;
    }
    stringRepresentation() {
        return `${this.address}: ${this.name} ${this.parameters.join(" ")}`;
    }
    parsePIParameters(instructions) {
        let addr = this.address;
        let pType = instructions[++addr];
        if (pType == 0) {
            this.parameters = [_readSplitNumber(instructions, ++addr, 4)];
            return 5;
        }
        else if (pType == 1) {
            this.parameters = [
                (() => {
                    let len = _readSplitNumber(instructions, ++addr, 2), str = "";
                    ++addr;
                    for (let i = 0; i < len; i++)
                        str += String.fromCharCode(instructions[++addr]);
                    return str;
                })(),
            ];
            return addr - this.address;
        }
        else
            this.parameters = [pType == 2 ? "null" : "{}"];
        return 1;
    }
    parseParameters(instructions) {
        let addr = this.address;
        if (this.parameterCount == 1) {
            this.parameters = [
                _readSplitNumber(instructions, ++addr, this.argumentCount),
            ];
            return this.argumentCount;
        }
        else if (this.parameterCount == 2)
            this.parameters = [instructions[++addr], instructions[++addr]];
        return addr - this.address;
    }
}
exports.Token = Token;
