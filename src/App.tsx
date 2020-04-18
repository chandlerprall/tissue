import React, {useEffect, useMemo, useState} from 'react';
import '@elastic/eui/dist/eui_theme_light.css';
import './App.css';
import {EuiDataGrid, EuiDataGridProps, EuiDataGridCellValueElementProps, EuiFieldText} from '@elastic/eui';

// @ts-ignore
import Store from 'insula';
// @ts-ignore
import { connect, Provider } from 'react-insula';

const COLUMN_COUNT = 10;
const ROW_COUNT = 20;

const columns: EuiDataGridProps['columns'] = [];
const generateColumnIdFromIndex = (n: number): string => n < 0 ? '' : generateColumnIdFromIndex(n / 26 - 1) + String.fromCharCode(n % 26 + 65);
for (let i = 0; i < COLUMN_COUNT; i++) {
  columns.push({ id: generateColumnIdFromIndex(i), isExpandable: false });
}

const leadingControlColumns: EuiDataGridProps['leadingControlColumns'] = [
  {
    id: 'asdf',
    headerCellRender: () => null,
    rowCellRender: ({ rowIndex }) => <strong>&nbsp;{rowIndex}</strong>,
    width: 40,
  },
];

const store = new Store({
  cells: {},
  cellDependencies: {},
  cellDependants: {},
  cellNotifiers: {},
});
for (let i = 0; i < COLUMN_COUNT; i++) {
    for (let j = 0; j < ROW_COUNT; j++) {
        const columnId = generateColumnIdFromIndex(i);
        const rowIndex = j.toString();
        store.setPartialState(['cells', `${columnId}${rowIndex}`], '');
    }
}

store.on(
  'SET_VALUE',
  ({ stateSelector, value }: { stateSelector: string[], value: string }, { setPartialState }: { setPartialState: Function }) => {
      setPartialState(stateSelector, value);
  }
);

store.on(
  'SET_NOTIFIER',
  ({ cellId, notifier }: { cellId: string, notifier: Function }, { setPartialState }: { setPartialState: Function } ) => {
    setPartialState(['cellNotifiers', cellId], notifier);
  }
);

store.on(
  'UPDATE_DEPENDENCIES',
  ({ cellId, value }: { cellId: string, value: string }, { getPartialState, setPartialState }: { getPartialState: Function, setPartialState: Function }) => {
    // 1 - update this cells dependencies
    const dependenciesSelector = ['cellDependencies', cellId];
    const oldDependencies: string[] = getPartialState(dependenciesSelector) || [];
    let dependencies: string[] = [];
    if (value.startsWith('=')) {
      dependencies = value.match(/[A-Z]+\d+/g) || [];
    }
    setPartialState(dependenciesSelector, dependencies);

    // 2 - update dependencies' dependants lists
    for (let i = 0; i < oldDependencies.length; i++) {
      const dependencyCellId = oldDependencies[i];
      const dependencysDependants = getPartialState(['cellDependants', dependencyCellId]).filter((dependantCell: string) => dependantCell !== cellId);
      setPartialState(['cellDependants', dependencyCellId], dependencysDependants);
    }
    for (let i = 0; i < dependencies.length; i++) {
      const dependencyCellId = dependencies[i];
      const dependencysDependants = (getPartialState(['cellDependants', dependencyCellId]) || []).slice();
      if (dependencysDependants.indexOf(cellId) === -1) {
        dependencysDependants.push(cellId);
      }
      setPartialState(['cellDependants', dependencyCellId], dependencysDependants);
    }

    // 3 - notify dependant cells
    notifyDependants(cellId, getPartialState);
  }
);

function notifyDependants(cellId: string, getPartialState: Function, depth = 0) {
  if (depth === 3) return; // prefer not infinite looping over definite consistency

  const dependants = getPartialState(['cellDependants', cellId]) || [];
  for (let i = 0; i < dependants.length; i++) {
    const dependantCell = dependants[i];
    getPartialState(['cellNotifiers', dependantCell])();
    notifyDependants(dependantCell, getPartialState, depth + 1);
  }
}

const columnVisibilty = {
  visibleColumns: columns.map(({ id }) => id),
  setVisibleColumns() {},
};

function evalCellValue(isFocused: boolean, value: string) {
  let displayValue = value;
  let isInvalid = false;
  if (isFocused === false && value.startsWith('=')) {
    try {
      displayValue = eval(
        value
          .substr(1, value.length - 1)
          .replace(
            /[A-Z]+\d+/g,
            (cellId) => {
              const result = evalCellValue(false, store.getPartialState(['cells', cellId]));
              return result.displayValue;
            }
          )
      );
    } catch (e) {
      displayValue = `#${e.message}#`;
      isInvalid = true;
    }
  }

  return { displayValue, isInvalid };
}

const UnconnectedCell = ({ value, setValue, stateSelector, setNotifier, updateDependencies }: { value: string, setValue: Function, stateSelector: string[], setNotifier: Function, updateDependencies: Function }) => {
  const [isFocused, setIsFocused] = useState(false);
  const { displayValue, isInvalid } = evalCellValue(isFocused, value);

  const cellId = stateSelector[1];

  const [, setNotifications] = useState(0);
  useEffect(
    () => {
      setNotifier({
        cellId,
        notifier: () => setNotifications(notifications => notifications + 1)
      });
    },
    []
  );

  return (
    <EuiFieldText
      className="tissueEntry"
      value={displayValue}
      isInvalid={isInvalid}
      onChange={(e) => setValue({ stateSelector, value: e.target.value })}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        updateDependencies({ cellId, value });
      }}
    />
  );
};
const useRenderCellValue = ({ rowIndex, columnId }: EuiDataGridCellValueElementProps) => {
  const stateSelector = useMemo(() => ['cells', `${columnId}${rowIndex}`], [ rowIndex, columnId ]);
  const connectedComponent = useMemo(
      () => {
          const ConnectedComponent = connect(
              [stateSelector],
              ([value]: [string], { bindDispatch }: { bindDispatch: Function }) => ({
                value,
                stateSelector,
                setValue: bindDispatch('SET_VALUE'),
                setNotifier: bindDispatch('SET_NOTIFIER'),
                updateDependencies: bindDispatch('UPDATE_DEPENDENCIES')
              })
          )(UnconnectedCell);
          return <ConnectedComponent/>;
      },
      [stateSelector]
  );
  return connectedComponent;
};

function App() {
  return (
    <Provider store={store}>
      <EuiDataGrid
        aria-label="EuiTissue"
        rowCount={ROW_COUNT}
        leadingControlColumns={leadingControlColumns}
        columns={columns}
        columnVisibility={columnVisibilty}
        renderCellValue={useRenderCellValue}
        gridStyle={{
          fontSize: 's',
        }}
        toolbarVisibility={false}
      />
    </Provider>
  );
}

export default App;
