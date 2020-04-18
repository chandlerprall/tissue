import React, { useMemo } from 'react';
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

const store = new Store();
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

const UnconnectedCell = ({ value, setValue, stateSelector }: { value: string, setValue: Function, stateSelector: string[] }) => {
  return (
    <EuiFieldText
      value={value}
      onChange={(e) => setValue({ stateSelector, value: e.target.value })}
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
                  setValue: bindDispatch('SET_VALUE'),
                  stateSelector
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
