const generateColumnIdFromIndex = (n: number): string => n < 0 ? '' : generateColumnIdFromIndex(n / 26 - 1) + String.fromCharCode(n % 26 + 65);

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

  private getDependenciesFromValue(value: string): Set<string> {
    if (value.startsWith('=')) {
      return new Set(value.match(/[A-Z]+\d+/g) || []);
    } else {
      return new Set();
    }
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

  public evalCellValue(cellId: string) {
    const value = this.getCellValue(cellId);
    let displayValue = value;
    let isInvalid = false;
    if (value.startsWith('=')) {
      try {
        displayValue = eval(
          value
            .substr(1, value.length - 1)
            .replace(
              /[A-Z]+\d+/g,
              (cellId) => {
                const result = this.evalCellValue(cellId);
                if (result.isInvalid) isInvalid = true;
                return result.displayValue;
              }
            )
        ) || '';
      } catch (e) {
        displayValue = `#${e.message}#`;
        isInvalid = true;
      }
    }

    return { displayValue, isInvalid };
  }
}