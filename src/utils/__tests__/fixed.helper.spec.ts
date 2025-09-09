import { FixedHelper } from '../fixed.util';
import { FixedNumber } from 'ethers';

describe('FixedHelper', () => {
  describe('create', () => {
    it('should create a FixedNumber from a string', () => {
      const result = FixedHelper.create('123.456');
      expect(result).toBeInstanceOf(FixedNumber);
      expect(result.toString()).toBe('123.456');
    });

    it('should create a FixedNumber from a number', () => {
      const result = FixedHelper.create(123.456);
      expect(result).toBeInstanceOf(FixedNumber);
      expect(result.toString()).toBe('123.456');
    });

    it('should handle custom decimals', () => {
      const result = FixedHelper.create('123.456', 6);
      expect(result).toBeInstanceOf(FixedNumber);
      expect(result.toString()).toBe('123.456');
    });
  });

  describe('fromBigInt', () => {
    it('should create a FixedNumber from a bigint', () => {
      const value = BigInt('123456789000000000000');
      const result = FixedHelper.fromBigInt(value);
      expect(result).toBeInstanceOf(FixedNumber);
      expect(result.toString()).toBe('123.456789');
    });

    it('should create a FixedNumber from a string representation of bigint', () => {
      const result = FixedHelper.fromBigInt('123456789000000000000');
      expect(result).toBeInstanceOf(FixedNumber);
      expect(result.toString()).toBe('123.456789');
    });

    it('should handle custom decimals', () => {
      const value = BigInt('123456789');
      const result = FixedHelper.fromBigInt(value, 6);
      expect(result).toBeInstanceOf(FixedNumber);
      expect(result.toString()).toBe('123.456789');
    });
  });

  describe('parseFixed and formatFixed', () => {
    it('should parse a string to a bigint representation', () => {
      const result = FixedHelper.parseFixed('123.456');
      expect(typeof result).toBe('bigint');
      expect(result.toString()).toBe('123456000000000000000');
    });

    it('should format a bigint to a decimal string', () => {
      const value = BigInt('123456000000000000000'); // Using BigInt constructor
      const result = FixedHelper.formatFixed(value);
      expect(typeof result).toBe('string');
      expect(result).toBe('123.456');
    });

    it('should handle custom decimals in parseFixed', () => {
      const result = FixedHelper.parseFixed('123.456', 6);
      expect(result.toString()).toBe('123456000');
    });

    it('should handle custom decimals in formatFixed', () => {
      const value = BigInt('123456000'); // Using BigInt constructor
      const result = FixedHelper.formatFixed(value, 6);
      expect(result).toBe('123.456');
    });
  });

  describe('arithmetic operations', () => {
    let value1: FixedNumber;
    let value2: FixedNumber;

    beforeEach(() => {
      value1 = FixedHelper.create('100');
      value2 = FixedHelper.create('25');
    });

    describe('add', () => {
      it('should add two FixedNumber values correctly', () => {
        const result = FixedHelper.add(value1, value2);
        expect(result.toString()).toBe('125.0');
      });

      it('should handle decimal places in addition', () => {
        const a = FixedHelper.create('0.1');
        const b = FixedHelper.create('0.2');
        const result = FixedHelper.add(a, b);
        expect(result.toString()).toBe('0.3');
      });
    });

    describe('subtract', () => {
      it('should subtract one FixedNumber from another correctly', () => {
        const result = FixedHelper.subtract(value1, value2);
        expect(result.toString()).toBe('75.0');
      });

      it('should handle negative results', () => {
        const result = FixedHelper.subtract(value2, value1);
        expect(result.toString()).toBe('-75.0');
      });
    });

    describe('multiply', () => {
      it('should multiply two FixedNumber values correctly', () => {
        const result = FixedHelper.multiply(value1, value2);
        expect(result.toString()).toBe('2500.0');
      });

      it('should handle decimal precision in multiplication', () => {
        const a = FixedHelper.create('0.1');
        const b = FixedHelper.create('0.2');
        const result = FixedHelper.multiply(a, b);
        expect(result.toString()).toBe('0.02');
      });
    });

    describe('divide', () => {
      it('should divide one FixedNumber by another correctly', () => {
        const result = FixedHelper.divide(value1, value2);
        expect(result.toString()).toBe('4.0');
      });

      it('should handle division with decimal precision', () => {
        const a = FixedHelper.create('10');
        const b = FixedHelper.create('3');
        const result = FixedHelper.divide(a, b);
        expect(result.toString().startsWith('3.333')).toBeTruthy();
      });
    });
  });

  describe('comparison operations', () => {
    let value1: FixedNumber;
    let value2: FixedNumber;
    let value3: FixedNumber;

    beforeEach(() => {
      value1 = FixedHelper.create('100');
      value2 = FixedHelper.create('100');
      value3 = FixedHelper.create('50');
    });

    describe('compare', () => {
      it('should return 0 when values are equal', () => {
        const result = FixedHelper.compare(value1, value2);
        expect(result).toBe(0);
      });

      it('should return 1 when first value is greater', () => {
        const result = FixedHelper.compare(value1, value3);
        expect(result).toBe(1);
      });

      it('should return -1 when first value is less', () => {
        const result = FixedHelper.compare(value3, value1);
        expect(result).toBe(-1);
      });
    });

    describe('equals', () => {
      it('should return true when values are equal', () => {
        expect(FixedHelper.equals(value1, value2)).toBe(true);
      });

      it('should return false when values are not equal', () => {
        expect(FixedHelper.equals(value1, value3)).toBe(false);
      });
    });

    describe('greaterThan', () => {
      it('should return true when first value is greater than second', () => {
        expect(FixedHelper.greaterThan(value1, value3)).toBe(true);
      });

      it('should return false when first value is not greater than second', () => {
        expect(FixedHelper.greaterThan(value3, value1)).toBe(false);
        expect(FixedHelper.greaterThan(value1, value2)).toBe(false);
      });
    });

    describe('lessThan', () => {
      it('should return true when first value is less than second', () => {
        expect(FixedHelper.lessThan(value3, value1)).toBe(true);
      });

      it('should return false when first value is not less than second', () => {
        expect(FixedHelper.lessThan(value1, value3)).toBe(false);
        expect(FixedHelper.lessThan(value1, value2)).toBe(false);
      });
    });
  });

  describe('conversion and formatting', () => {
    let value: FixedNumber;
    let negValue: FixedNumber;

    beforeEach(() => {
      value = FixedHelper.create('123.456');
      negValue = FixedHelper.create('-123.456');
    });

    describe('abs', () => {
      it('should return the absolute value of a positive number', () => {
        const result = FixedHelper.abs(value);
        expect(result.toString()).toBe('123.456');
      });

      it('should return the absolute value of a negative number', () => {
        const result = FixedHelper.abs(negValue);
        expect(result.toString()).toBe('123.456');
      });
    });

    describe('toNumber', () => {
      it('should convert a FixedNumber to a JavaScript number', () => {
        const result = FixedHelper.toNumber(value);
        expect(typeof result).toBe('number');
        expect(result).toBeCloseTo(123.456, 3);
      });
    });

    describe('toString', () => {
      it('should convert a FixedNumber to a string', () => {
        const result = FixedHelper.toString(value);
        expect(typeof result).toBe('string');
        expect(result).toBe('123.456');
      });
    });

    describe('round', () => {
      it('should round to specified decimal places', () => {
        const numToRound = FixedHelper.create('123.4567');
        const result = FixedHelper.round(numToRound, 2);
        expect(result).toBe('123.46');
      });

      it('should not modify values that already have fewer decimals than specified', () => {
        const numToRound = FixedHelper.create('123.4');
        const result = FixedHelper.round(numToRound, 3);
        expect(result).toBe('123.4');
      });

      it('should handle rounding of values with no decimal part', () => {
        const numToRound = FixedHelper.create('123');
        const result = FixedHelper.round(numToRound, 2);
        expect(result).toBe('123.0');
      });
    });
  });
});
