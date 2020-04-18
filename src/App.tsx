import React, {useMemo, useState} from 'react';
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
              const result = evalCellValue(true, store.getPartialState(['cells', cellId]));
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

const UnconnectedCell = ({ value, setValue, stateSelector, setNotifier }: { value: string, setValue: Function, stateSelector: string[], setNotifier: Function }) => {
  const [isFocused, setIsFocused] = useState(false);
  const { displayValue, isInvalid } = evalCellValue(isFocused, value);

  return (
    <EuiFieldText
      className="tissueEntry"
      value={displayValue}
      isInvalid={isInvalid}
      onChange={(e) => setValue({ stateSelector, value: e.target.value })}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
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
