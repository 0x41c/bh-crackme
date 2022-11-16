import {
  Program,
  Node,
  VariableDeclaration,
  Identifier,
  AssignmentExpression,
  Literal,
  BinaryExpression,
  UnaryExpression,
  IfStatement,
  FunctionDeclaration,
  ExpressionStatement,
  CallExpression,
  MemberExpression,
  BlockStatement,
  ReturnStatement,
  ArrayExpression,
  CatchClause,
  ThrowStatement,
  TryStatement,
  _AST_Type,
} from "./ast";
import { Token, TokenType } from "./token";

let identToFunction: { [identifier: string]: FunctionDeclaration } = {};
let identToVariable: { [identifier: string]: VariableDeclaration } = {};
let variablesSim: Identifier[][] = [[], [], [], []];

class _tokenParser {
  tokens: Token[];
  checkedAddresses: number[] = [];
  physicalAddrToVirt: Token[] = [];

  idx: number = 0;
  didJump: boolean = false;

  depth: number = 0;

  // TODO: Dynamic memory allocation for stacks.
  variableNameStack: number[] = new Array(3000).fill(0);
  functionNameStack: number[] = new Array(3000).fill(0);

  stackState: Identifier[] = [];

  program: Program;
  currentBlock: Node[] = [];
  blockEnd: boolean = false;

  constructor(tokens: Token[], depth?: number) {
    this.tokens = tokens;

    for (let token of this.tokens)
      this.physicalAddrToVirt[token.address] = token;

    depth && (this.depth = depth);
  }

  private get eof(): boolean {
    return this.idx >= this.tokens.length;
  }

  // We shouldn't overflow here because of external checks
  private get curr(): Token {
    return this.tokens[this.idx];
  }

  private get nextVarName(): string {
    return `var${++this.variableNameStack[this.depth]}`;
  }

  private get nextFuncName(): string {
    return `func${++this.functionNameStack[this.depth]}`;
  }

  private delVarName(number = 1) {
    this.variableNameStack[this.depth] -= number;
  }

  private delFuncName(number = 1) {
    this.functionNameStack[this.depth] -= number;
  }

  private last(offset: number = 0): Token {
    if (this.idx >= 1) return this.tokens[this.idx - (offset + 1)];
    return null;
  }

  private exitBlock = () => (this.blockEnd = true);

  private bump(): Token {
    return this.tokens[++this.idx];
  }

  private redact(amount: number = 1) {
    let nodes = this.currentBlock.splice(this.currentBlock.length - amount);
    for (let node of nodes) {
      if (node.type == _AST_Type.VariableDecl) this.delVarName();
      else if (node.type == _AST_Type.FunctionDecl) this.delFuncName();
    }
  }

  private jumpToAddr(physicalAddr: number) {
    let newTok = this.physicalAddrToVirt[physicalAddr];
    if (newTok != null) this.idx = this.tokens.indexOf(newTok);
    else this.exitBlock();
    this.didJump = true;
  }

  private defineVar(node: Node): VariableDeclaration {
    let decl = new VariableDeclaration(node, this.nextVarName);
    this.stackState.push(decl.declaration.id);
    identToVariable[decl.declaration.id.name] = decl;
    return decl;
  }

  private enterNextScope(address: number, stack: Identifier[]): Node[] {
    let ndepth = this.depth + 1;
    let parser = new _tokenParser(this.tokens, ndepth);

    parser.variableNameStack[ndepth] = this.variableNameStack[this.depth];
    parser.functionNameStack[ndepth] = this.functionNameStack[this.depth];

    parser.stackState = stack;
    parser.jumpToAddr(address);
    parser.didJump = false;
    parser.checkedAddresses = this.checkedAddresses;

    let blk = parser.visitBlockBody();

    return blk;
  }

  private visitNext(): Node {
    if (this.checkedAddresses.includes(this.curr.address)) return;
    this.checkedAddresses.push(this.curr.address);

    switch (this.curr.type) {
      case TokenType.STACK:
        let specialCases = [
          "CLEAR_STACK",
          "DEFLATE_STACK",
          "INFLATE_STACK",
          "POP_STACK",
          "REVERSE_STACK",
        ];
        if (!specialCases.includes(this.curr.configKey))
          return this.visitStackVarDecl();
        else this.evalStackMutators();

        return null;
      case TokenType.MATH:
        return this.visitMathVarDecl();
      case TokenType.CONTROL_FLOW:
        return this.visitControlFlow();
      case TokenType.FUNCTION:
        return this.visitFunction();
      case TokenType.VARIABLE:
        return this.visitVariable();
      case TokenType.ARRAY:
        return this.visitArrayOperation();
      case TokenType.MISC:
        return this.visitJSONStringify();
    }
  }

  private visitJSONStringify(): ExpressionStatement {
    let memberExpr = new MemberExpression( // TODO: Properly join identifiers
      new Identifier("JSON"),
      new Identifier("stringify")
    );
    let callExpr = new CallExpression(memberExpr, [this.stackState.pop()]);
    return new ExpressionStatement(callExpr);
  }

  private visitArrayOperation(): Node {
    switch (this.curr.configKey) {
      case "ASSIGN_ARRAY":
        return this.visitArrayAssignExpr();
      case "CREATE_ARRAY":
        return this.visitArrayCreationExpr();
      case "SUBSCRIPT_ARRAY":
        return this.visitArraySubscExpr();
    }
  }

  private visitArrayAssignExpr(): ExpressionStatement {
    let objId = this.stackState.pop();
    let subScriptId = this.stackState.pop();
    let valueId = this.stackState.pop();
    let shouldTrack = true;

    if (
      valueId &&
      identToVariable[valueId.name] &&
      identToVariable[valueId.name].declaration.init.type == _AST_Type.Literal
    ) {
      this.redact();
      shouldTrack = false;
      valueId = identToVariable[valueId.name].declaration.init as any;
    }

    if (objId.name != "variables") {
      let decl = identToVariable[objId.name];
      let memberExpr = decl.declaration.init as MemberExpression;

      let realObjId: Identifier = memberExpr.object as Identifier;
      if (realObjId.type == _AST_Type.Identifier) {
        let firstSubId = memberExpr.property as Identifier;

        if (
          !(
            firstSubId.type != _AST_Type.Literal &&
            !identToVariable[firstSubId.name]
          )
        ) {
          let secondSubId = subScriptId;

          let obj: Identifier;
          if (!Object.keys(identToVariable).includes(realObjId.name))
            obj = realObjId;
          else
            obj = identToVariable[realObjId.name].declaration
              .init as Identifier;

          let sub1: Literal;
          if (firstSubId.type == _AST_Type.Literal) sub1 = firstSubId as any;
          else
            sub1 = identToVariable[firstSubId.name].declaration.init as Literal;

          let sub2 = identToVariable[secondSubId.name].declaration
            .init as Literal;

          this.redact(2);

          if (obj.name == "variables") {
            let idx1 = sub1.value as number;
            let idx2 = sub2.value as number;
            if (idx1 && idx2 && valueId && shouldTrack) {
              variablesSim[idx1][idx2] = valueId;
            }
          }

          let memberExpr1 = new MemberExpression(obj, sub1);
          let memberExpr2 = new MemberExpression(memberExpr1, sub2);
          let assignmentExpr = new AssignmentExpression(
            "=",
            memberExpr2,
            valueId
          );
          return new ExpressionStatement(assignmentExpr);
        }
      }
    }

    let memberExpr = new MemberExpression(objId, subScriptId);
    let assignExpr = new AssignmentExpression("=", memberExpr, valueId);
    return new ExpressionStatement(assignExpr);
  }

  private visitArrayCreationExpr(): VariableDeclaration {
    let length = this.curr.parameters[0];
    let ids: Identifier[] = [];
    while (length-- != 0) ids.push(this.stackState.pop());

    let arrExpr = new ArrayExpression(ids);
    return this.defineVar(arrExpr);
  }

  private visitArraySubscExpr(): VariableDeclaration {
    let id = this.stackState.pop();
    let subScriptId = this.stackState.pop();

    if (id.name != "variables") {
      let obj = identToVariable[id.name];

      let subScrpVar: Identifier | Literal;

      if (subScriptId == null) subScrpVar = new Identifier("UNKNOWN");
      else
        subScrpVar = identToVariable[subScriptId.name].declaration.init as
          | Identifier
          | Literal;

      if (
        subScrpVar.type == _AST_Type.Literal &&
        typeof (subScrpVar as Literal).value == "string"
      )
        this.redact(2);
      else this.redact(2);

      // TODO: Better fix for literal subscripting;
      let val = obj.declaration.init;
      if (val.type == _AST_Type.Literal) val = id;

      let arrExpr = new MemberExpression(val, subScrpVar);
      return this.defineVar(arrExpr);
    }

    let arrExpr = new MemberExpression(id, subScriptId);
    return this.defineVar(arrExpr);
  }

  private visitVariable(): Node {
    switch (this.curr.configKey) {
      case "STORE_IN_VARIABLE":
        return this.visitVariableStore();
      case "LOAD_FROM_VARIABLE":
        return this.visitVariableLoad();
    }
  }

  // TODO: Disambiguate the use of "variables"

  private visitVariableStore(): ExpressionStatement {
    let idx1 = this.curr.parameters[0];
    let idx2 = this.curr.parameters[1];
    let assignee = this.stackState.pop();

    if (
      assignee &&
      identToVariable[assignee.name] &&
      identToVariable[assignee.name].declaration.init.type == _AST_Type.Literal
    ) {
      assignee = identToVariable[assignee.name].declaration.init as any;
    } else {
      variablesSim[idx1][idx2] = assignee;
    }

    let memberExpr1 = new MemberExpression(
      new Identifier("variables"),
      new Literal(idx1)
    );

    let memberExpr2 = new MemberExpression(memberExpr1, new Literal(idx2));

    let assignmentExpr = new AssignmentExpression("=", memberExpr2, assignee);

    return new ExpressionStatement(assignmentExpr);
  }

  private visitVariableLoad(): VariableDeclaration {
    let memberExpr1 = new MemberExpression(
      new Identifier("variables"),
      new Literal(this.curr.parameters[0])
    );

    let memberExpr2 = new MemberExpression(
      memberExpr1,
      new Literal(this.curr.parameters[1])
    );

    return this.defineVar(memberExpr2);
  }

  private visitFunction(): Node {
    switch (this.curr.configKey) {
      case "CALL_FUNCTION_IN_STACK":
        return this.visitFunctionCallsite();
      case "DEFINE_FUNCTION_START":
        return this.visitFunctionDeclaration();
      case "EXIT_FUNCTION": // This is actually "exit(popStack());"
        this.exitBlock();
        return new ReturnStatement(this.stackState.pop());
    }
  }

  private visitFunctionCallsite(): VariableDeclaration {
    let paramCount = this.curr.parameters[0];

    // Fill in function values
    let functionIdent =
      this.stackState[this.stackState.length - paramCount - 1];
    let funcDecl = identToFunction[functionIdent.name];

    if (!funcDecl) {
      let varDecl = identToVariable[functionIdent.name];
      if (varDecl) {
        let init: MemberExpression = varDecl.declaration.init as any;
        if (init.type == _AST_Type.MemberExpression) {
          let objId = (init.object as MemberExpression).object;
          if (objId && objId.type == _AST_Type.Identifier) {
            let lit1 = (init.object as MemberExpression).property as Literal;
            let lit2 = init.property as Literal;

            if (
              lit1.type == _AST_Type.Literal &&
              lit2.type == _AST_Type.Literal
            ) {
              funcDecl =
                identToFunction[
                  variablesSim[lit1.value as number][lit2.value as number].name
                ];
            }
          }
        }
      }
    }

    if (funcDecl && funcDecl.block.body.length == 0) {
      funcDecl.paramCount = paramCount;

      let simStack: Identifier[] = [];
      for (let i = 0; i < paramCount; i++)
        simStack.push(new Identifier(`arg${i}`));
      funcDecl.block.body = this.enterNextScope(funcDecl.startAddr, simStack);
    }

    // Return to call site.
    let args: Identifier[] = [];
    for (
      let i = this.stackState.length - paramCount;
      i < this.stackState.length;
      i++
    )
      args.push(this.stackState[i]);

    let callExpr = new CallExpression(functionIdent, args);
    let exprStatement = new ExpressionStatement(callExpr);

    return this.defineVar(exprStatement);
  }

  private visitFunctionDeclaration(): FunctionDeclaration {
    let decl = new FunctionDeclaration(
      this.curr.address + 4,
      0,
      this.nextFuncName
    );
    this.stackState.push(decl.id);
    decl.jmpAddr = this.curr.parameters[0];
    this.jumpToAddr(decl.jmpAddr);
    identToFunction[decl.id.name] = decl;
    return decl;
  }

  private visitControlFlow(): Node | undefined {
    switch (this.curr.configKey) {
      case "LOAD_PC":
        return this.visitConditionalJump();
      case "SET_PC":
        this.visitUnconditionalJump();
        break;
      case "THROW":
      case "THROW_STACK_POP":
        return this.visitThrowStatement();
    }
  }

  private visitThrowStatement(): ThrowStatement {
    // Throws are a joke lmao
    let catchAddr = this.last().parameters[0];
    if (this.curr.configKey != "THROW_STACK_POP")
      this.stackState.push(this.stackState[this.stackState.length - 1]);
    this.jumpToAddr(catchAddr);
    return;
  }

  private visitUnconditionalJump() {
    let [a, b] = [this.last(1).parameters[0], this.last(2).parameters[0]];
    this.jumpToAddr(a ^ b);
    this.redact(3);
    this.stackState.pop();
    return;
  }

  private visitConditionalJump(): IfStatement {
    let index = this.idx;
    let token;
    let tokens: Token[] = [];

    while (
      ((token = this.tokens[index++]),
      tokens.push(token),
      token.configKey != "SET_PC")
    );

    let conditionId = this.stackState[this.stackState.length - 1];

    let decl = identToVariable[conditionId.name];
    let startAddr = tokens[0].address;
    let endAddr =
      (tokens[2].parameters[0] ^ tokens[3].parameters[0]) + startAddr;

    let rel1 = (tokens[7].parameters[0] ^ tokens[8].parameters[0]) - startAddr;
    let rel2 = rel1 - (tokens[11].parameters[0] ^ tokens[12].parameters[0]);

    let consequentAddr = rel2 + endAddr;

    for (let token of tokens)
      if (!this.checkedAddresses.includes(token.address))
        this.checkedAddresses.push(token.address);

    if (
      decl &&
      decl.declaration.init.type == _AST_Type.Literal &&
      (decl.declaration.init as Literal).value
    )
      this.jumpToAddr(consequentAddr);
    else {
      let consequentBlock: BlockStatement = new BlockStatement([]);
      consequentBlock.body = this.enterNextScope(consequentAddr, [
        ...this.stackState,
      ]);

      if (this.last().configKey == "LOGICAL_NOT") {
        if(this.stackState[this.stackState.length - 1]) {
          let name = "!" + this.stackState[this.stackState.length - 1].name
          name = `!var${parseInt(name.split("var")[1]) - 1}`;
          conditionId.name = name;
        }
        else conditionId.name = "!UNKNOWN"; 
        this.redact();
      }

      this.jumpToAddr(endAddr);

      return new IfStatement(conditionId, consequentBlock);
    }
  }

  private visitStackVarDecl(): VariableDeclaration {
    let init: Node = null;
    switch (this.curr.configKey) {
      case "COPY":
        this.stackState.push(this.stackState[this.stackState.length - 1]);
        return;
      case "PUSH_IMMEDIATE":
        init = new Literal(this.curr.parameters[0]); // A single immediate is provided
        if ((init as Literal).value == "Function") break;
        break;
      case "PUSH_INTERPRETER_TO_STACK":
        init = new Identifier("interpreter");
        break;
      case "PUSH_VARS_TO_STACK":
        init = new Identifier("variables");
        break;
      case "PUSH_WINDOW":
        init = new Identifier("globalThis");
        break;
      case "PUSH_CATCH_POINTER":
        return; // Special case for throwing
    }
    return this.defineVar(init);
  }

  private evalStackMutators() {
    switch (this.curr.configKey) {
      case "CLEAR_STACK":
        this.stackState = [];
        break;
      case "DEFLATE_STACK":
        for (var i = this.curr.parameters[0]; this.stackState.length > i; )
          this.stackState.pop();

        break;
      case "INFLATE_STACK":
        for (var i = this.curr.parameters[0]; this.stackState.length < i; )
          this.stackState.push(void 0);
        break;
      case "POP_STACK":
        this.stackState.pop();
        break;
      case "REVERSE_STACK":
        var [swapCount, stackLength] = [
          this.curr.parameters[0],
          this.stackState.length - 1,
        ];
        if (2 == swapCount) {
          [this.stackState[stackLength], this.stackState[stackLength - 1]] = [
            this.stackState[stackLength - 1],
            this.stackState[stackLength],
          ];
        } else {
          for (var c = [], d = 0; d < swapCount; d++)
            c.push(this.stackState.pop());
          this.stackState.push(...c);
        }
        break;
    }
  }

  private visitMathVarDecl(): VariableDeclaration {
    let operator = "";
    switch (this.curr.configKey) {
      case "ADD":
        operator = "+";
      case "AND":
        operator = "&";
      case "GREATER_THAN":
        operator = ">";
      case "GREATER_THAN_OR_EQUAL":
        operator = "> = ";
      case "LEFT_SHIFT":
        operator = "<<";
      case "MODULUS":
        operator = "%";
      case "MULTIPLY":
        operator = "*";
      case "NOT_EQUAL":
        operator = "!=";
      case "OR":
        operator = "|";
      case "RIGHT_SHIFT":
        operator = ">>";
      case "SMALLER_THAN":
        operator = "<";
      case "SMALLER_THAN_OR_EQUAL":
        operator = "<=";
      case "SQUARE":
        operator = "**";
      case "SUBTRACT":
        operator = "-";
      case "XOR":
        operator = "^";
    }

    if (operator == "") {
      if (
        this.curr.configKey == "NOT" ||
        this.curr.configKey == "LOGICAL_NOT"
      ) {
        let unaryExpr = new UnaryExpression(
          this.curr.configKey == "NOT" ? "~" : "!",
          true,
          this.stackState.pop()
        );
        let exprStatement = new ExpressionStatement(unaryExpr);
        return this.defineVar(exprStatement);
      } else return null;
    }

    let binaryExpr = new BinaryExpression(
      operator,
      this.stackState.pop(),
      this.stackState.pop()
    );
    let exprStatement = new ExpressionStatement(binaryExpr);
    return this.defineVar(exprStatement);
  }

  visitProgram(): Program {
    this.program = new Program();
    this.program.block.body = this.visitBlockBody();
    return this.program;
  }

  visitBlockBody(): Node[] {
    this.currentBlock = [];
    while (!this.eof && !this.blockEnd) {
      let next = this.visitNext();
      next && this.currentBlock.push(next);
      !this.didJump ? this.bump() : (this.didJump = false);
    }

    return this.currentBlock;
  }
}

export function parseTokens(tokens: Token[]): Program {
  let parser = new _tokenParser(tokens);
  return parser.visitProgram();
}
