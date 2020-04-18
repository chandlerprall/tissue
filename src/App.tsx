import React, {createContext, FunctionComponent, useContext, useEffect, useState} from 'react';
import '@elastic/eui/dist/eui_theme_light.css';
import './App.css';
import {EuiPanel, EuiText, EuiCode, EuiDataGrid, EuiDataGridProps, EuiDataGridCellValueElementProps, EuiFieldText, EuiButtonEmpty} from '@elastic/eui';
import Sheet from "./Sheet";

const COLUMN_COUNT = 10;
const ROW_COUNT = 20;

const columns: EuiDataGridProps['columns'] = [];
const generateColumnIdFromIndex = (n: number): string => n < 0 ? '' : generateColumnIdFromIndex(n / 26 - 1) + String.fromCharCode(n % 26 + 65);
for (let i = 0; i < COLUMN_COUNT; i++) {
  columns.push({ id: generateColumnIdFromIndex(i), isExpandable: false });
}

const leadingControlColumns: EuiDataGridProps['leadingControlColumns'] = [
  {
    id: 'rowcount',
    headerCellRender: () => null,
    rowCellRender: ({ rowIndex }) => <strong>&nbsp;{rowIndex + 1}</strong>,
    width: 40,
  },
];

const sheet = new Sheet(COLUMN_COUNT, ROW_COUNT);
const SheetContext = createContext(sheet);

const columnVisibilty = {
  visibleColumns: columns.map(({ id }) => id),
  setVisibleColumns() {},
};

const UnconnectedCell: FunctionComponent<EuiDataGridCellValueElementProps> = ({ rowIndex, columnId }) => {
  const sheet = useContext(SheetContext);
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState('');

  const [{ isInvalid, displayValue }, setDisplayValue] = useState({ isInvalid: false, displayValue: '' });

  const cellId = `${columnId}${rowIndex + 1}`;

  useEffect(
    () => {
      sheet.setCellNotifier(
        cellId,
        () => setDisplayValue(sheet.evalCellValue(cellId))
      );
    },
    [cellId, sheet]
  );

  return (
    <EuiFieldText
      className="tissueEntry"
      value={isFocused ? value : displayValue}
      isInvalid={isInvalid}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        sheet.setCellValue(cellId, value);
      }}
    />
  );
};

function App() {
  return (
    <SheetContext.Provider value={sheet}>
      <EuiPanel>
        <EuiText>
          A small spreadsheet app built on top of EuiDataGrid. Cell values starting with <EuiCode>=</EuiCode> are run through <EuiCode>eval()</EuiCode>, so great power yadda yadda. Cell names are dynamically replaced with their values at execution.
          <EuiButtonEmpty iconType="logoGithub" iconSide="right" href="https://github.com/chandlerprall/tissue" target="_blank">View on GitHub</EuiButtonEmpty>
        </EuiText>
      </EuiPanel>
      <EuiDataGrid
        aria-label="EuiTissue"
        rowCount={ROW_COUNT}
        leadingControlColumns={leadingControlColumns}
        columns={columns}
        columnVisibility={columnVisibilty}
        renderCellValue={UnconnectedCell}
        gridStyle={{
          fontSize: 's',
        }}
        toolbarVisibility={false}
      />
    </SheetContext.Provider>
  );
}

export default App;
