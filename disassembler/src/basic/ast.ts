export enum _AST_Type {
  Program = "Program",
  Literal = "Literal",
  Identifier = "Identifier",

  // Statements
  BlockStatement = "BlockStatement",
  ExpressionStatement = "ExpressionStatement",
  IfStatement = "IfStatement",
  ReturnStatement = "ReturnStatement",
  TryStatement = "TryStatement",
  ThrowStatement = "ThrowStatement",

  // Declarations
  VariableDecl = "VariableDecl",
  VariableDeclarator = "VariableDeclarator",
  FunctionDecl = "FunctionDecl",

  // Expressions
  ArrayExpression = "ArrayExpression",
  AssignmentExpression = "AssignmentExpression",
  MemberExpression = "MemberExpression",
  BinaryExpression = "BinaryExpression",
  UnaryExpression = "UnaryExpression",
  CallExpression = "CallExpression",

  CatchClause = "CatchClause",

  Unknown = "Unknown",
}

export class Unknown {
  type = _AST_Type.Unknown;
}

export type Node = {
  type: _AST_Type;
  stringRepresentation: () => string;
};

class _AST_Node {
  type: _AST_Type;

  constructor({ type = null as _AST_Type }) {
    this.type = type;
  }

  stringRepresentation(): string {
    return "";
  }
}

export class BlockStatement extends _AST_Node {
  body: _AST_Node[] = [];

  constructor(body: _AST_Node[] = null) {
    super({
      type: _AST_Type.BlockStatement,
    });
    body && (this.body = body);
  }

  stringRepresentation(): string {
    let body = [];
    for (let node of this.body) body.push(node.stringRepresentation());
    return `{${body.join(";")}}`;
  }
}

export class CatchClause extends _AST_Node {
  param?: Identifier;
  body: BlockStatement;

  constructor(body: BlockStatement, param?: Identifier) {
    super({
      type: _AST_Type.CatchClause,
    });
    this.body = body;
    this.param = param;
  }

  stringRepresentation(): string {
    let ret = "catch";

    if (this.param != null) ret += `(${this.param.stringRepresentation()})`;
    ret += this.body.stringRepresentation();
    return ret;
  }
}

export class TryStatement extends _AST_Node {
  block: BlockStatement;
  handler: CatchClause;

  constructor(block: BlockStatement, handler: CatchClause) {
    super({
      type: _AST_Type.TryStatement,
    });

    this.block = block;
    this.handler = handler;
  }

  stringRepresentation(): string {
    return `try ${this.block.stringRepresentation()} ${this.handler.stringRepresentation()}`;
  }
}

export class Program extends _AST_Node {
  block: BlockStatement = new BlockStatement();

  constructor(block: BlockStatement = null) {
    super({
      type: _AST_Type.Program,
    });
    block && (this.block = block);
  }

  stringRepresentation(): string {
    return this.block.stringRepresentation();
  }
}

export class Literal extends _AST_Node {
  value: number | string;

  constructor(value: number | string) {
    super({
      type: _AST_Type.Literal,
    });
    this.value = value;
  }

  stringRepresentation(): string {
    if (
      typeof this.value == "string" &&
      this.value != "null" &&
      this.value != "{}"
    )
      return `"${this.value}"`;
    return `${this.value}`;
  }
}

export class Identifier extends _AST_Node {
  name: string;

  constructor(name: string) {
    super({
      type: _AST_Type.Identifier,
    });
    this.name = name;
  }

  stringRepresentation(): string {
    return `${this.name}`;
  }
}

class _Expression extends _AST_Node {
  left: _AST_Node;
  right: _AST_Node;

  constructor(type: _AST_Type, left: _AST_Node, right: _AST_Node) {
    super({
      type,
    });
    this.left = left;
    this.right = right;
  }
}

export class MemberExpression extends _AST_Node {
  object: _AST_Node;
  property: Literal | Identifier;

  constructor(object: _AST_Node, property: Literal | Identifier) {
    super({
      type: _AST_Type.MemberExpression,
    });

    this.object = object;
    this.property = property;
  }

  stringRepresentation(): string {
    if (this.object == null) this.object = new Identifier("UNKNOWN");
    if (this.property == null) this.property = new Identifier("UNKNOWN");

    let ret = `${this.object.stringRepresentation()}`;
    let isIdentLiteral =
      this.property.type == "Literal" &&
      typeof (this.property as Literal).value == "string";

    ret += `${
      isIdentLiteral
        ? `.${(this.property as Literal).value}`
        : `[${this.property.stringRepresentation()}]`
    }`;

    return ret;
  }
}

// TODO: Move these two expressions to a single stringRepresentation

export class AssignmentExpression extends _Expression {
  operator: string;

  constructor(operator: string, left: _AST_Node, right: _AST_Node) {
    super(_AST_Type.AssignmentExpression, left, right);
    this.operator = operator;
  }

  stringRepresentation(): string {
    if (this.right == null) this.right = new Identifier("UNKNOWN");
    if (this.left == null) this.left = new Identifier("UNKNOWN");
    return `${this.left.stringRepresentation()} ${
      this.operator
    } ${this.right.stringRepresentation()}`;
  }
}

export class BinaryExpression extends _Expression {
  operator: string;

  constructor(operator: string, left: _AST_Node, right: _AST_Node) {
    super(_AST_Type.BinaryExpression, left, right);
    this.operator = operator;
  }

  stringRepresentation(): string {
    if (this.right == null) this.right = new Identifier("UNKNOWN");
    if (this.left == null) this.left = new Identifier("UNKNOWN");
    return `${this.left.stringRepresentation()} ${
      this.operator
    } ${this.right.stringRepresentation()}`;
  }
}

export class UnaryExpression extends _AST_Node {
  operator: string;
  prefix: boolean;
  argument: _AST_Node;

  constructor(operator: string, prefix: boolean, argument: _AST_Node) {
    super({ type: _AST_Type.UnaryExpression });
    this.operator = operator;
    this.prefix = prefix;
    this.argument = argument;
  }

  stringRepresentation(): string {
    return `${this.prefix ? this.operator : ""}${this.argument.stringRepresentation()}${
      !this.prefix ? this.operator : ""
    }`;
  }
}

export class CallExpression extends _AST_Node {
  callee: Identifier | MemberExpression;
  arguments: Identifier[];

  constructor(callee: Identifier | MemberExpression, _arguments: Identifier[]) {
    super({ type: _AST_Type.CallExpression });
    this.callee = callee;
    this.arguments = _arguments;
  }

  stringRepresentation(): string {
    return `${this.callee.stringRepresentation()}(${this.arguments
      .map((v) => v.stringRepresentation())
      .join(",")})`;
  }
}

export class ArrayExpression extends _AST_Node {
  elements: Identifier[] = [];

  constructor(elements: Identifier[]) {
    super({
      type: _AST_Type.ArrayExpression,
    });
    this.elements = elements;
  }

  stringRepresentation(): string {
    return `[${this.elements.join(",")}]`;
  }
}

export class ExpressionStatement extends _AST_Node {
  expression: _AST_Node;

  constructor(expression: _AST_Node) {
    super({
      type: _AST_Type.ExpressionStatement,
    });
    this.expression = expression;
  }

  stringRepresentation(): string {
    return this.expression.stringRepresentation();
  }
}

export class VariableDeclarator extends _AST_Node {
  id: Identifier;
  init: _AST_Node;

  constructor(init: _AST_Node, name: string) {
    super({
      type: _AST_Type.VariableDeclarator,
    });
    this.id = new Identifier(name);
    this.init = init;
  }

  stringRepresentation(): string {
    if (this.id == null) this.id = new Identifier("UNKNOWN");
    if (this.init == null) this.init = new Identifier("UNKNOWN");
    return `${this.id.stringRepresentation()} = ${this.init.stringRepresentation()}`;
  }
}

// TODO: Disambiguate variable scopes and accessors by reference and mutation counting

export enum VariableDeclarationKind {
  VAR = "var",
  LET = "let",
  CONST = "const",
}

export class VariableDeclaration extends _AST_Node {
  declaration: VariableDeclarator;
  kind: VariableDeclarationKind = VariableDeclarationKind.VAR;

  constructor(init: _AST_Node, name: string) {
    super({
      type: _AST_Type.VariableDecl,
    });
    this.declaration = new VariableDeclarator(init, name);
  }

  stringRepresentation(): string {
    return `${this.kind} ${this.declaration.stringRepresentation()}`;
  }
}

export class FunctionDeclaration extends _AST_Node {
  id: Identifier;
  paramCount: number;
  block: BlockStatement = new BlockStatement();
  startAddr: number;
  jmpAddr: number;

  constructor(startAddr: number, paramCount: number | null = 0, name: string) {
    super({
      type: _AST_Type.FunctionDecl,
    });
    this.id = new Identifier(name);
    this.paramCount = paramCount;
    this.startAddr = startAddr;
  }

  stringRepresentation(): string {
    let args = [];
    for (let i = 0; i < this.paramCount; i++) args.push(`arg${i}`);

    return `function ${this.id.stringRepresentation()}(${args.join(
      ","
    )}) ${this.block.stringRepresentation()}`;
  }
}

export class IfStatement extends _AST_Node {
  test: Identifier;
  consequent: BlockStatement;
  alternate?: IfStatement | BlockStatement;

  constructor(
    test: Identifier,
    consequent: BlockStatement,
    alternate?: IfStatement | BlockStatement
  ) {
    super({
      type: _AST_Type.IfStatement,
    });

    this.test = test;
    this.consequent = consequent;
    alternate && (this.alternate = alternate);
  }

  stringRepresentation(): string {
    let ret = "";

    if (this.test == null) this.test = new Identifier("UNKNOWN");

    ret += `if(${this.test.stringRepresentation()})${this.consequent.stringRepresentation()}`;

    if (this.alternate != null)
      ret += `else${this.alternate.stringRepresentation()}`;
    return ret;
  }
}

export class ReturnStatement extends _AST_Node {
  argument: _AST_Node;

  constructor(argument?: _AST_Node) {
    super({
      type: _AST_Type.ReturnStatement,
    });

    this.argument = argument;
  }

  stringRepresentation(): string {
    return (
      "return" +
      (this.argument != null
        ? " " + this.argument.stringRepresentation()
        : "") +
      ";"
    );
  }
}

export class ThrowStatement extends _AST_Node {
  argument: Identifier | Literal;

  constructor(argument: Identifier | Literal) {
    super({
      type: _AST_Type.ThrowStatement,
    });

    this.argument = argument;
  }

  stringRepresentation(): string {
    return `throw ${this.argument.stringRepresentation()};`;
  }
}
