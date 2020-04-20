import { Parser } from './sagebrush/language';

const generateColumnIdFromIndex = (n: number): string => n < 0 ? '' : generateColumnIdFromIndex(n / 26 - 1) + String.fromCharCode(n % 26 + 65);

const syntax = `
#token COLON :
#token CELL (?<id>[A-Z]+\\d+)

#token NUMBER (?<value>-?(\\d|[1-9]\\d+)(\\.\\d+)?([eE](+|-)?\\d+)?)
#token STRING "(?<value>([^\\\\"]|\\\\(["\\\\/bfnrt]|u\\d\\d\\d\\d))*)"

#expr Range = (?<start>CELL) COLON (?<end>CELL)
#expr ValueReference = (?<target>NUMBER | STRING | CELL | Range)
#token IDENTITY (?<name>[a-zA-Z]+)

#token L_PAREN \\(
#token R_PAREN \\)
#token COMMA ,
// #expr Command = (?<method>IDENTITY) L_PAREN (?<arguments>ValueReference)? (COMMA (?<arguments>ValueReference))*  R_PAREN
#expr Command = (?<method>IDENTITY) L_PAREN (?<arguments>ValueReference | Command)? (COMMA (?<arguments>ValueReference | Command))*  R_PAREN

#token EQUALS \\=
#expr Program = EQUALS (?<instruction>ValueReference | Command)
`;

interface NUMBER {
  type: 'NUMBER';
  value: string;
}
interface STRING {
  type: 'STRING';
  value: string;
}
interface CELL {
  type: 'CELL';
  id: string;
}
interface Range {
  type: 'Range';
  start: [CELL],
  end: [CELL],
}

interface ValueReference {
  type: 'ValueReference';
  target: [NUMBER | STRING | CELL | Range];
}

interface IDENTITY {
  type: 'IDENTITY';
  name: string;
}
interface Command {
  type: 'Command';
  method: [IDENTITY];
  arguments?: Array<ValueReference | Command>;
}

interface SheetProgram {
  type: 'Program';
  instruction: [ValueReference | Command];
}

type ProgramNode = Command | ValueReference | Range | CELL | STRING | NUMBER;

export const assertNever = (x: never): never => {
  throw new Error(`Unexpected value ${x}`);
};

function safeEmptyString(arg: any) {
  if (typeof arg === 'string' && arg.length === 0) return '0';
  return arg;
}
const sheetProgramMethods: { [key: string]: (...args: any[]) => string } = {
  sum: (...args) => args.reduce((sum, arg) => sum + parseFloat(safeEmptyString(arg)), 0),
  diff: (...args) => args.reduce((result, arg, idx) => result - (idx === 0 ? 0 : parseFloat(safeEmptyString(arg))), parseFloat(safeEmptyString(args[0]))),
  concat: (...args) => args.reduce((result, arg) => `${result}${arg}`, '')
};

export default class Sheet {
  readonly columnIds: string[] = [];
  private readonly cellValues = new Map<string, string>();
  private readonly cellDependencies = new Map<string, Set<string>>();
  private readonly cellDependants = new Map<string, Set<string>>();
  private readonly cellNotifiers = new Map<string, () => void>();

  constructor(public readonly columns: number, public readonly rows: number) {
    // populate
    for (let i = 0; i < columns; i++) {
      const columnId = generateColumnIdFromIndex(i);
      this.columnIds.push(columnId);
      for (let j = 0; j < rows; j++) {
        const cellId = `${columnId}${j+1}`;
        this.cellValues.set(cellId, '');
      }
    }
  }

  private gatherDependenciesFromProgram(node: ProgramNode, dependencies: Set<string>): void {
    switch (node.type) {
      case 'NUMBER':
        break;
      case 'STRING':
        break;
      case 'CELL':
        dependencies.add(node.id);
        break;
      case 'Range': {
        const { start: [start], end: [end] } = node;

        const startColumn = start.id.match(/[A-Z]+/)![0];
        const startRow = parseInt(start.id.match(/\d+/)![0], 10);

        const endColumn = end.id.match(/[A-Z]+/)![0];
        const endRow = parseInt(end.id.match(/\d+/)![0], 10);

        if (startColumn !== endColumn) throw new Error('Ranges cannot span columns');

        const rowChangeDirection = startRow < endRow ? 1 : -1;
        const condition = (i: number) => {
          if (rowChangeDirection === 1) {
            return i <= endRow;
          } else {
            return i >= endRow;
          }
        };
        for (let i = startRow; condition(i); i += rowChangeDirection) {
          dependencies.add(`${startColumn}${i}`);
        }
        break;
      }
      case 'ValueReference':
        this.gatherDependenciesFromProgram(node.target[0], dependencies);
        break;
      case 'Command': {
        const { arguments: _args } = node;

        (_args || []).forEach(arg => {
          switch (arg.type) {
            case 'ValueReference':
              return this.gatherDependenciesFromProgram(arg.target[0], dependencies);
            case 'Command':
              return this.gatherDependenciesFromProgram(arg, dependencies);
            default:
              assertNever(arg);
          }
        });
        break;
      }
      default:
        assertNever(node);
    }
  }

  private getDependenciesFromValue(value: string): Set<string> {
    if (value.startsWith('=')) {
      const parser = new Parser(`${syntax}${value}`);
      const result = parser.parse();

      if (result instanceof Error === false && result.isCompleteMatch === true) {
        const sheetProgram = result as unknown as SheetProgram;
        const dependencies = new Set<string>();
        this.gatherDependenciesFromProgram(sheetProgram.instruction[0], dependencies);
        return dependencies;
      }

      return new Set(value.match(/[A-Z]+\d+/g) || []);
    }
    return new Set();
  }

  private notifyDependantCells(cellId: string, notified = new Set()) {
    if (notified.has(cellId)) return;
    notified.add(cellId);

    const notifier = this.cellNotifiers.get(cellId);
    if (notifier) notifier();

    const dependants = Array.from(this.cellDependants.get(cellId) || []);
    for (let i = 0; i < dependants.length; i++) {
      this.notifyDependantCells(dependants[i], notified);
    }
  }

  public setCellNotifier(cellId: string, notifier: () => void) {
    this.cellNotifiers.set(cellId, notifier);
  }

  public setCellValue(cellId: string, value: string) {
    this.cellValues.set(cellId, value);

    // update this cell's dependencies
    const oldDependencies = Array.from(this.cellDependencies.get(cellId) || []);
    const newDependencies = this.getDependenciesFromValue(value);

    // remove this cell from its old dependants
    for (let i = 0; i < oldDependencies.length; i++) {
      const oldDependency = oldDependencies[i];
      if (newDependencies.has(oldDependency) === false) {
        const dependants = this.cellDependants.get(oldDependency);
        if (dependants) dependants.delete(cellId);
      }
    }

    // add this cell to its new dependants
    const newDepsArray = Array.from(newDependencies);
    for (let i = 0; i < newDepsArray.length; i++) {
      const newDep = newDepsArray[i];
      const newDepDependants = this.cellDependants.get(newDep) || new Set<string>();
      newDepDependants.add(cellId);
      this.cellDependants.set(newDep, newDepDependants);
    }

    // update this cell's dependencies
    this.cellDependencies.set(cellId, newDependencies);

    this.notifyDependantCells(cellId);
  }

  public getCellValue(cellId: string) {
    return this.cellValues.get(cellId) || '';
  }

  private resolveProgramNode(node: ProgramNode): string | number | Array<string | number> {
    switch (node.type) {
      case 'NUMBER':
        return parseFloat(node.value);
      case 'STRING':
        return node.value;
      case 'CELL': {
        const { displayValue, isInvalid } = this.evalCellValue(node.id);
        if (isInvalid) throw new Error(displayValue);
        return displayValue;
      }
      case 'Range': {
        const values: Array<number | string> = [];

        const { start: [start], end: [end] } = node;

        const startColumn = start.id.match(/[A-Z]+/)![0];
        const startRow = parseInt(start.id.match(/\d+/)![0], 10);

        const endColumn = end.id.match(/[A-Z]+/)![0];
        const endRow = parseInt(end.id.match(/\d+/)![0], 10);

        if (startColumn !== endColumn) throw new Error('Ranges cannot span columns');

        const rowChangeDirection = startRow < endRow ? 1 : -1;
        const condition = (i: number) => {
          if (rowChangeDirection === 1) {
            return i <= endRow;
          } else {
            return i >= endRow;
          }
        };
        for (let i = startRow; condition(i); i += rowChangeDirection) {
          const {displayValue, isInvalid} = this.evalCellValue(`${startColumn}${i}`);
          if (isInvalid) throw new Error(displayValue);
          values.push(displayValue);
        }

        return values;
      }
      case 'ValueReference':
        return this.resolveProgramNode(node.target[0]);
      case 'Command': {
        const { method: _method, arguments: _args } = node;
        const method = _method[0].name.toLowerCase();

        if (sheetProgramMethods.hasOwnProperty(method) === false) {
          throw new Error(`${method} is not a valid method`);
        }
        const args = (_args || []).map(arg => {
          switch (arg.type) {
            case 'ValueReference':
              return this.resolveProgramNode(arg.target[0]);
            case 'Command':
              return this.resolveProgramNode(arg);
            default:
              assertNever(arg);
              return '';
          }
        }).flat(100);
        return sheetProgramMethods[method]!.apply(null, args);
      }
      default:
        assertNever(node);
        return '';
    }
  }

  private executeProgram(program: ReturnType<Parser['parse']>): { displayValue: string, isInvalid: boolean } {
    try {
      const sheetProgram = program as unknown as SheetProgram;
      return {
        displayValue: this.resolveProgramNode(sheetProgram.instruction[0]).toString(),
        isInvalid: false,
      }
    } catch (e) {
      return {
        displayValue: e.message,
        isInvalid: true,
      };
    }
  }

  public evalCellValue(cellId: string) {
    const value = this.getCellValue(cellId);
    if (value.startsWith('=')) {
      let result: Error | ReturnType<Parser['parse']>;
      try {
        const parser = new Parser(`${syntax}${value}`);
        result = parser.parse();

        if (result instanceof Error) throw result;
        if (result.isCompleteMatch === false) {
          throw new Error('Invalid syntax');
        }

        return this.executeProgram(result);
      } catch (e) {
        return {
          displayValue: e.message,
          isInvalid: false,
        };
      }
    } else {
      return {
        displayValue: value,
        isInvalid: false,
      };
    }
    // if (value.startsWith('=')) {
    //   try {
    //     displayValue = eval(
    //       value
    //         .substr(1, value.length - 1)
    //         .replace(
    //           /[A-Z]+\d+/g,
    //           (cellId) => {
    //             const result = this.evalCellValue(cellId);
    //             if (result.isInvalid) isInvalid = true;
    //             return result.displayValue;
    //           }
    //         )
    //     ) || '';
    //   } catch (e) {
    //     displayValue = `#${e.message}#`;
    //     isInvalid = true;
    //   }
    // }
  }
}