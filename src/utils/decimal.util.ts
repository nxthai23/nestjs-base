import { Decimal } from 'decimal.js';

/**
 * Helper class for handling decimal operations with precision using decimal.js
 */
export class DecimalHelper {
  /**
   * Creates a new Decimal instance
   * @param value - The value to convert to Decimal
   * @returns A new Decimal instance
   */
  static create(value: string | number | Decimal): Decimal {
    return new Decimal(value);
  }

  /**
   * Adds two or more values
   * @param a - First value
   * @param b - Second value
   * @param values - Additional values to add
   * @returns The sum as a Decimal
   */
  static add(
    a: string | number | Decimal,
    b: string | number | Decimal,
    ...values: Array<string | number | Decimal>
  ): Decimal {
    let result = new Decimal(a).plus(b);
    for (const value of values) {
      result = result.plus(value);
    }
    return result;
  }

  /**
   * Subtracts one or more values from the first value
   * @param a - First value
   * @param b - Value to subtract
   * @param values - Additional values to subtract
   * @returns The difference as a Decimal
   */
  static subtract(
    a: string | number | Decimal,
    b: string | number | Decimal,
    ...values: Array<string | number | Decimal>
  ): Decimal {
    let result = new Decimal(a).minus(b);
    for (const value of values) {
      result = result.minus(value);
    }
    return result;
  }

  /**
   * Multiplies two or more values
   * @param a - First value
   * @param b - Second value
   * @param values - Additional values to multiply
   * @returns The product as a Decimal
   */
  static multiply(
    a: string | number | Decimal,
    b: string | number | Decimal,
    ...values: Array<string | number | Decimal>
  ): Decimal {
    let result = new Decimal(a).times(b);
    for (const value of values) {
      result = result.times(value);
    }
    return result;
  }

  /**
   * Divides the first value by one or more values
   * @param a - First value (dividend)
   * @param b - Second value (divisor)
   * @param values - Additional divisors
   * @returns The quotient as a Decimal
   */
  static divide(
    a: string | number | Decimal,
    b: string | number | Decimal,
    ...values: Array<string | number | Decimal>
  ): Decimal {
    let result = new Decimal(a).div(b);
    for (const value of values) {
      result = result.div(value);
    }
    return result;
  }

  /**
   * Compares two values
   * @param a - First value
   * @param b - Second value
   * @returns -1 if a < b, 0 if a = b, 1 if a > b
   */
  static compare(
    a: string | number | Decimal,
    b: string | number | Decimal,
  ): number {
    return new Decimal(a).comparedTo(b);
  }

  /**
   * Checks if two values are equal
   * @param a - First value
   * @param b - Second value
   * @returns true if values are equal, false otherwise
   */
  static equals(
    a: string | number | Decimal,
    b: string | number | Decimal,
  ): boolean {
    return new Decimal(a).equals(b);
  }

  /**
   * Checks if the first value is greater than the second
   * @param a - First value
   * @param b - Second value
   * @returns true if a > b, false otherwise
   */
  static greaterThan(
    a: string | number | Decimal,
    b: string | number | Decimal,
  ): boolean {
    return new Decimal(a).greaterThan(b);
  }

  /**
   * Checks if the first value is less than the second
   * @param a - First value
   * @param b - Second value
   * @returns true if a < b, false otherwise
   */
  static lessThan(
    a: string | number | Decimal,
    b: string | number | Decimal,
  ): boolean {
    return new Decimal(a).lessThan(b);
  }

  /**
   * Rounds a value to specified decimal places
   * @param value - The value to round
   * @param decimalPlaces - Number of decimal places (default: 0)
   * @param roundingMode - Rounding mode (default: Decimal.ROUND_HALF_UP)
   * @returns The rounded Decimal
   */
  static round(
    value: string | number | Decimal,
    decimalPlaces = 0,
    roundingMode = Decimal.ROUND_HALF_UP,
  ): Decimal {
    return new Decimal(value).toDecimalPlaces(decimalPlaces, roundingMode);
  }

  /**
   * Formats a Decimal to a string with specified options
   * @param value - The value to format
   * @param decimalPlaces - Number of decimal places
   * @param roundingMode - Rounding mode
   * @returns Formatted string representation
   */
  static format(
    value: string | number | Decimal,
    decimalPlaces?: number,
    roundingMode = Decimal.ROUND_HALF_UP,
  ): string {
    const decimal = new Decimal(value);
    if (decimalPlaces !== undefined) {
      return decimal.toDecimalPlaces(decimalPlaces, roundingMode).toString();
    }
    return decimal.toString();
  }

  /**
   * Converts a Decimal to a number
   * @param value - The value to convert
   * @returns The value as a number
   */
  static toNumber(value: string | number | Decimal): number {
    return new Decimal(value).toNumber();
  }

  /**
   * Gets the absolute value
   * @param value - The input value
   * @returns The absolute value as a Decimal
   */
  static abs(value: string | number | Decimal): Decimal {
    return new Decimal(value).abs();
  }
}
