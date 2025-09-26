import { differenceBy, intersectionBy } from 'lodash';

// Helper function to create a key extractor for both single and multiple keys
function createKeyExtractor<T>(key: string | string[]) {
  return (item: Partial<T>): string => {
    if (typeof key === 'string') {
      const value = item[key as keyof T];
      return value != null ? String(value) : '';
    }

    return key
      .map((k) => {
        const value = item[k as keyof T];
        return value != null ? String(value) : '';
      })
      .join('|'); // Use pipe separator for better uniqueness
  };
}

/**
 * Finds items that need to be created (items in second array that don't exist in first array)
 * Works regardless of parameter order - always returns items to create
 * @param existingData - Current/existing data array
 * @param newData - New/seed data array to compare against
 * @param key - Single key or array of keys to use for comparison
 * @returns Items that need to be created
 */
export const findCreateData = <T>(
  existingData: T[],
  newData: Partial<T>[],
  key: string | string[],
): Partial<T>[] => {
  const keyExtractor = createKeyExtractor<T>(key);
  return differenceBy(newData, existingData, keyExtractor);
};

/**
 * Finds items that need to be updated (items in second array that exist in first array)
 * Works regardless of parameter order - always returns items to update
 * @param existingData - Current/existing data array
 * @param newData - New/seed data array to compare against
 * @param key - Single key or array of keys to use for comparison
 * @returns Items that need to be updated
 */
export const findUpdateData = <T>(
  existingData: T[],
  newData: Partial<T>[],
  key: string | string[],
): Partial<T>[] => {
  const keyExtractor = createKeyExtractor<T>(key);
  return intersectionBy(newData, existingData, keyExtractor);
};
