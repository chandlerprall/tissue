import React, {createContext, FunctionComponent, useContext, useEffect, useState} from 'react';
import '@elastic/eui/dist/eui_theme_light.css';
import './App.css';
import {EuiLink, EuiPanel, EuiText, EuiCode, EuiDataGrid, EuiDataGridProps, EuiDataGridCellValueElementProps, EuiFieldText, EuiButtonEmpty} from '@elastic/eui';
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

sheet.setCellValue('A1', 'Item');
sheet.setCellValue('B1', 'Cost');

sheet.setCellValue('A2', 'apple');
sheet.setCellValue('B2', '3.50');

sheet.setCellValue('A3', 'butter');
sheet.setCellValue('B3', '7.36');

sheet.setCellValue('A4', 'one shoe');
sheet.setCellValue('B4', '39.99');

sheet.setCellValue('D1', '=concat("Total cost is ", sum(B2:B20))');

const columnVisibilty = {
  visibleColumns: columns.map(({ id }) => id),
  setVisibleColumns() {},
};

const UnconnectedCell: FunctionComponent<EuiDataGridCellValueElementProps> = ({ rowIndex, columnId }) => {
  const cellId = `${columnId}${rowIndex + 1}`;

  const sheet = useContext(SheetContext);
  const [isFocused, setIsFocused] = useState(false);
  const [value, setValue] = useState(sheet.getCellValue(cellId));

  const [{ isInvalid, displayValue }, setDisplayValue] = useState(sheet.evalCellValue(cellId));

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
          <div>
            <EuiButtonEmpty iconType="logoGithub" iconSide="right" href="https://github.com/chandlerprall/tissue" target="_blank">View on GitHub</EuiButtonEmpty>
          </div>
          <div>
            A small spreadsheet app built on top of <EuiLink href="https://elastic.github.io/eui/#/tabular-content/data-grid" target="_blank">EuiDataGrid</EuiLink>. Cells values are computed when starting with <EuiCode>=</EuiCode>. Some examples:
          </div>
          <ul>
            <li><EuiCode>=C4</EuiCode> references the value in C4</li>
            <li><EuiCode>=B2:B12</EuiCode> references the values in the range of cells from B2 to B12</li>
            <li><EuiCode>=sum(cell, range, 5, "5")</EuiCode> adds the value arguments; values can be a cell, range, number, or string; multiple values can be specified by comma separating</li>
            <li><EuiCode>=diff(cell, range, 5, "5")</EuiCode> subtracts 1...N arguments from the first</li>
            <li><EuiCode>=concat(cell, range, 5, "5")</EuiCode> concatenates the provided values</li>
          </ul>
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
