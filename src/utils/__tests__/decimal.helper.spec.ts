import { DecimalHelper } from '../decimal.util';
import { Decimal } from 'decimal.js';

describe('DecimalHelper', () => {
  describe('create', () => {
    it('should create a new Decimal instance from a number', () => {
      const result = DecimalHelper.create(123.456);
      expect(result).toBeInstanceOf(Decimal);
      expect(result.toString()).toBe('123.456');
    });

    it('should create a new Decimal instance from a string', () => {
      const result = DecimalHelper.create('123.456');
      expect(result).toBeInstanceOf(Decimal);
      expect(result.toString()).toBe('123.456');
    });

    it('should handle very large numbers', () => {
      const largeNumber = '9'.repeat(10) + '.' + '9'.repeat(10);
      const result = DecimalHelper.create(largeNumber);
      expect(result.toString()).toBe(largeNumber);
    });
  });

  describe('arithmetic operations', () => {
    describe('add', () => {
      it('should add two numbers correctly', () => {
        const result = DecimalHelper.add('123.45', '67.89');
        expect(result.toString()).toBe('191.34');
        const result1 = DecimalHelper.add(0.1, 0.2);
        expect(result1.toString()).toBe('0.3');
      });

      it('should add multiple numbers correctly', () => {
        const result = DecimalHelper.add('10', '20', '30', '40');
        expect(result.toString()).toBe('100');
      });

      it('should handle negative numbers', () => {
        const result = DecimalHelper.add('100', '-50');
        expect(result.toString()).toBe('50');
      });
    });

    describe('subtract', () => {
      it('should subtract two numbers correctly', () => {
        const result = DecimalHelper.subtract('123.45', '67.89');
        expect(result.toString()).toBe('55.56');
      });

      it('should subtract multiple numbers correctly', () => {
        const result = DecimalHelper.subtract('100', '20', '30', '10');
        expect(result.toString()).toBe('40');
      });

      it('should handle negative results', () => {
        const result = DecimalHelper.subtract('50', '75');
        expect(result.toString()).toBe('-25');
      });
    });

    describe('multiply', () => {
      it('should multiply two numbers correctly', () => {
        const result = DecimalHelper.multiply('12.34', '5.6');
        expect(result.toString()).toBe('69.104');
      });

      it('should multiply multiple numbers correctly', () => {
        const result = DecimalHelper.multiply('2', '3', '4', '5');
        expect(result.toString()).toBe('120');
      });

      it('should handle decimal precision correctly', () => {
        const result = DecimalHelper.multiply('0.1', '0.2');
        expect(result.toString()).toBe('0.02');
      });
    });

    describe('divide', () => {
      it('should divide two numbers correctly', () => {
        const result = DecimalHelper.divide('100', '4');
        expect(result.toString()).toBe('25');
      });

      it('should divide with decimal precision', () => {
        const result = DecimalHelper.divide('10', '3');
        expect(result.toString().startsWith('3.3333')).toBeTruthy();
      });

      it('should handle multiple divisors correctly', () => {
        const result = DecimalHelper.divide('100', '2', '5');
        expect(result.toString()).toBe('10');
      });
    });
  });

  describe('comparison operations', () => {
    describe('compare', () => {
      it('should return -1 when first value is less than second', () => {
        expect(DecimalHelper.compare('5', '10')).toBe(-1);
      });

      it('should return 0 when values are equal', () => {
        expect(DecimalHelper.compare('10', '10')).toBe(0);
      });

      it('should return 1 when first value is greater than second', () => {
        expect(DecimalHelper.compare('15', '10')).toBe(1);
      });
    });

    describe('equals', () => {
      it('should return true when values are equal', () => {
        expect(DecimalHelper.equals('10.00', '10')).toBe(true);
      });

      it('should return false when values are not equal', () => {
        expect(DecimalHelper.equals('10.01', '10')).toBe(false);
      });
    });

    describe('greaterThan', () => {
      it('should return true when first value is greater than second', () => {
        expect(DecimalHelper.greaterThan('10.1', '10')).toBe(true);
      });

      it('should return false when first value is less than or equal to second', () => {
        expect(DecimalHelper.greaterThan('10', '10')).toBe(false);
        expect(DecimalHelper.greaterThan('9.9', '10')).toBe(false);
      });
    });

    describe('lessThan', () => {
      it('should return true when first value is less than second', () => {
        expect(DecimalHelper.lessThan('9.9', '10')).toBe(true);
      });

      it('should return false when first value is greater than or equal to second', () => {
        expect(DecimalHelper.lessThan('10', '10')).toBe(false);
        expect(DecimalHelper.lessThan('10.1', '10')).toBe(false);
      });
    });
  });

  describe('formatting and conversion', () => {
    describe('round', () => {
      it('should round to specified decimal places', () => {
        const value = DecimalHelper.create('12.3456789');
        const result = DecimalHelper.round(value, 4);
        expect(result.toString()).toBe('12.3457');
      });

      it('should round up correctly', () => {
        expect(DecimalHelper.round('9.995', 2).toString()).toBe('10');
      });

      it('should round down correctly', () => {
        expect(DecimalHelper.round('9.994', 2).toString()).toBe('9.99');
      });

      it('should handle rounding with default parameters', () => {
        expect(DecimalHelper.round('9.5').toString()).toBe('10');
      });
    });

    describe('format', () => {
      it('should format to specified decimal places', () => {
        const result = DecimalHelper.format('12.3456789', 3);
        expect(result).toBe('12.346');
      });

      it('should return full string when no decimal places specified', () => {
        expect(DecimalHelper.format('12.3456789')).toBe('12.3456789');
      });
    });

    describe('toNumber', () => {
      it('should convert Decimal to JavaScript number', () => {
        const result = DecimalHelper.toNumber('123.456');
        expect(result).toBe(123.456);
        expect(typeof result).toBe('number');
      });
    });

    describe('abs', () => {
      it('should return absolute value of positive number', () => {
        expect(DecimalHelper.abs('10').toString()).toBe('10');
      });

      it('should return absolute value of negative number', () => {
        expect(DecimalHelper.abs('-10').toString()).toBe('10');
      });

      it('should handle zero correctly', () => {
        expect(DecimalHelper.abs('0').toString()).toBe('0');
      });
    });
  });
});
