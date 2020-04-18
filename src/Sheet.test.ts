import Sheet from './Sheet';

describe('Sheet', () => {
  it('calls a cell notifier when it updates', () => {
    const sheet = new Sheet(5, 3);
    const cellNotifier = jest.fn();
    sheet.setCellNotifier('A1', cellNotifier);

    expect(cellNotifier).toHaveBeenCalledTimes(0);

    sheet.setCellValue('A1', 'test');

    expect(cellNotifier).toHaveBeenCalledTimes(1);
    expect(sheet.getCellValue('A1')).toBe('test');
  });

  it('calls a dependant notifier when it updates', () => {
    const sheet = new Sheet(5, 3);
    const cellNotifier = jest.fn();
    sheet.setCellNotifier('A1', cellNotifier);
    sheet.setCellValue('A1', '=B1');

    expect(cellNotifier).toHaveBeenCalledTimes(1);

    sheet.setCellValue('B1', 'test');

    expect(cellNotifier).toHaveBeenCalledTimes(2);
  });
});