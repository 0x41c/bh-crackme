import { exit } from "process";

export enum TokenType {
  MATH = "math",
  STACK = "stack",
  CONTROL_FLOW = "control_flow",
  FUNCTION = "function",
  VARIABLE = "variable",
  ARRAY = "array",
  MISC = "misc"
}

function _readSplitNumber(
  instructions: Array<number>,
  startAddr: number,
  splits: number
): number {
  let number = 0,
    offset = 0;
  for (let i = splits - 1; i != -1; i--, offset++) {
    let n = instructions[startAddr + offset] << (8 * i);
    if (i == splits - 1) number = n;
    else number |= n;
  }
  return number;
}

export class Token {
  public name: string;
  public configKey: string;
  public opcode: number;
  public address: number;
  public argumentCount?: number;
  public parameterCount?: number;
  public variableArguments?: boolean;
  public type: TokenType;
  public parameters: Array<any> = [];

  private constructor() {}

  private static makeOpaque(transparent: any): Token {
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

  public get hasArguments() {
    return !!(this.argumentCount && this.parameterCount);
  }
  public get isOpaque(): boolean {
    return true;
  }

  public static tokenize(
    instructions: Array<number>,
    configuration: { instructions: { [key: string]: Token } }
  ): Array<Token> {
    let tokens: Array<Token> = [];

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
        exit();
      }

      let token = this.makeOpaque({ ...knownInstructions[instruction] });
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

  public stringRepresentation(): string {
    return `${this.address}: ${this.name} ${this.parameters.join(" ")}`;
  }

  private parsePIParameters(instructions: Array<number>): number {
    let addr = this.address;
    let pType = instructions[++addr];
    if (pType == 0) {
      this.parameters = [_readSplitNumber(instructions, ++addr, 4)];
      return 5;
    } else if (pType == 1) {
      this.parameters = [
        (() => {
          let len = _readSplitNumber(instructions, ++addr, 2),
            str = "";
          ++addr;
          for (let i = 0; i < len; i++)
            str += String.fromCharCode(instructions[++addr]);
          return str;
        })(),
      ];
      return addr - this.address;
    } else this.parameters = [pType == 2 ? "null" : "{}"];
    return 1;
  }

  private parseParameters(instructions: Array<number>): number {
    let addr = this.address;
    if (this.parameterCount == 1) {
      this.parameters = [
        _readSplitNumber(instructions, ++addr, this.argumentCount),
      ];
      return this.argumentCount;
    } else if (this.parameterCount == 2)
      this.parameters = [instructions[++addr], instructions[++addr]];
    return addr - this.address;
  }
}
