import { FixedNumber } from 'ethers';

/**
 * Helper class for handling fixed-point number operations using ethers
 */
export class FixedHelper {
  /**
   * Creates a new FixedNumber instance
   * @param value - The value to convert to FixedNumber
   * @param decimals - Number of decimals (default: 18)
   * @returns A new FixedNumber instance
   */
  static create(value: string | number, decimals = 18): FixedNumber {
    if (typeof value === 'number') {
      value = value.toString();
    }
    return FixedNumber.fromString(value, { decimals });
  }

  /**
   * Creates a FixedNumber from a big number value
   * @param value - The big number value (as string or number)
   * @param decimals - Number of decimals (default: 18)
   * @returns A new FixedNumber instance
   */
  static fromBigInt(value: string | bigint, decimals = 18): FixedNumber {
    return FixedNumber.fromValue(value, decimals);
  }

  /**
   * Parses a value to a bigint representation
   * @param value - The value to parse
   * @param decimals - Number of decimals (default: 18)
   * @returns The parsed bigint
   */
  static parseFixed(value: string, decimals = 18): bigint {
    // Manual implementation of parseFixed since ethers v6 API has changed
    const parts = value.split('.');
    let whole = parts[0] || '0';
    let fraction = parts[1] || '';

    // Remove negative sign for processing
    const isNegative = whole.startsWith('-');
    if (isNegative) {
      whole = whole.substring(1);
    }

    // Pad or truncate fraction as needed
    if (fraction.length > decimals) {
      fraction = fraction.substring(0, decimals);
    } else {
      fraction = fraction.padEnd(decimals, '0');
    }

    // Combine and convert to bigint
    let result = BigInt(whole + fraction);
    if (isNegative) {
      result = -result;
    }

    return result;
  }

  /**
   * Formats a bigint to a decimal string representation
   * @param value - The bigint value
   * @param decimals - Number of decimals (default: 18)
   * @returns Formatted decimal string
   */
  static formatFixed(value: bigint, decimals = 18): string {
    // Manual implementation of formatFixed since ethers v6 API has changed
    const negative = value < 0n;
    const absValue = negative ? -value : value;

    let stringValue = absValue.toString();

    // Pad with leading zeros if needed
    if (stringValue.length <= decimals) {
      stringValue = stringValue.padStart(decimals + 1, '0');
    }

    // Insert decimal point
    const wholePart =
      stringValue.slice(0, stringValue.length - decimals) || '0';
    const fractionalPart = stringValue.slice(stringValue.length - decimals);

    // Trim trailing zeros
    const trimmed = fractionalPart.replace(/0+$/, '');
    const result = trimmed.length > 0 ? `${wholePart}.${trimmed}` : wholePart;

    return negative ? '-' + result : result;
  }

  /**
   * Adds two FixedNumber values
   * @param a - First value
   * @param b - Second value
   * @returns The sum as a FixedNumber
   */
  static add(a: FixedNumber, b: FixedNumber): FixedNumber {
    return a.add(b);
  }

  /**
   * Subtracts one FixedNumber from another
   * @param a - First value
   * @param b - Value to subtract
   * @returns The difference as a FixedNumber
   */
  static subtract(a: FixedNumber, b: FixedNumber): FixedNumber {
    return a.sub(b);
  }

  /**
   * Multiplies two FixedNumber values
   * @param a - First value
   * @param b - Second value
   * @returns The product as a FixedNumber
   */
  static multiply(a: FixedNumber, b: FixedNumber): FixedNumber {
    return a.mul(b);
  }

  /**
   * Divides one FixedNumber by another
   * @param a - Dividend
   * @param b - Divisor
   * @returns The quotient as a FixedNumber
   */
  static divide(a: FixedNumber, b: FixedNumber): FixedNumber {
    return a.div(b);
  }

  /**
   * Compares two FixedNumber values
   * @param a - First value
   * @param b - Second value
   * @returns -1 if a < b, 0 if a = b, 1 if a > b
   */
  static compare(a: FixedNumber, b: FixedNumber): number {
    if (a.eq(b)) return 0;
    return a.lt(b) ? -1 : 1;
  }

  /**
   * Checks if two FixedNumber values are equal
   * @param a - First value
   * @param b - Second value
   * @returns true if values are equal, false otherwise
   */
  static equals(a: FixedNumber, b: FixedNumber): boolean {
    return a.eq(b);
  }

  /**
   * Checks if the first value is greater than the second
   * @param a - First value
   * @param b - Second value
   * @returns true if a > b, false otherwise
   */
  static greaterThan(a: FixedNumber, b: FixedNumber): boolean {
    return a.gt(b);
  }

  /**
   * Checks if the first value is less than the second
   * @param a - First value
   * @param b - Second value
   * @returns true if a < b, false otherwise
   */
  static lessThan(a: FixedNumber, b: FixedNumber): boolean {
    return a.lt(b);
  }

  /**
   * Gets the absolute value of a FixedNumber
   * @param value - The input value
   * @returns The absolute value as a FixedNumber
   */
  static abs(value: FixedNumber): FixedNumber {
    // Implementation for abs since it might not be available in ethers v6
    if (this.lessThan(value, FixedNumber.fromString('0'))) {
      return this.multiply(value, FixedNumber.fromString('-1'));
    }
    return value;
  }

  /**
   * Converts a FixedNumber to a regular number
   * @param value - The FixedNumber value
   * @returns The value as a regular number
   */
  static toNumber(value: FixedNumber): number {
    return Number(value.toString());
  }

  /**
   * Converts a FixedNumber to a string
   * @param value - The FixedNumber value
   * @returns The value as a string
   */
  static toString(value: FixedNumber): string {
    return value.toString();
  }

  /**
   * Rounds a FixedNumber to specified decimal places
   * @param value - The value to round
   * @param decimals - Number of decimal places
   * @returns The rounded value as a string
   */
  static round(value: FixedNumber, decimals: number): string {
    const valueStr = value.toString();
    const parts = valueStr.split('.');

    if (parts.length === 1 || parts[1].length <= decimals) {
      return valueStr;
    }

    const intPart = parts[0];
    let fracPart = parts[1].slice(0, decimals);

    // Simple rounding logic
    if (parts[1].length > decimals) {
      const nextDigit = parseInt(parts[1][decimals], 10);
      if (nextDigit >= 5) {
        // Need to round up
        const lastDigit = parseInt(fracPart[fracPart.length - 1], 10) + 1;
        if (lastDigit < 10) {
          fracPart = fracPart.slice(0, -1) + lastDigit;
        } else {
          // Handle carrying
          return this.create(valueStr).toString(); // Use ethers built-in functionality
        }
      }
    }

    return fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
  }
}
