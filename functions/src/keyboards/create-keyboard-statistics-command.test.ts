import { CreateKeyboardStatisticsCommand } from './create-keyboard-statistics-command';

describe('create-keyboard-statistics-command', () => {
  describe('createDefaultDateValueMap', () => {
    it('should return object with date string and 0 in 90 days', () => {
      // Arrange
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const expected: { [key: string]: number } = {};
      for (
        let date = ninetyDaysAgo;
        date <= now;
        date.setDate(date.getDate() + 1)
      ) {
        expected[date.toISOString().substring(0, 10)] = 0;
      }

      // Act
      const actual =
        CreateKeyboardStatisticsCommand.createDefaultDateValueMap();

      // Assert
      expect(actual).toEqual(expected);
    });
  });
});
