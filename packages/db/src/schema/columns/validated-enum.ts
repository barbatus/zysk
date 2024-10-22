import { DrizzleError } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";

/**
 * A custom Drizzle type that stores a given enum as text with validation
 */
export const validatedStringEnum = <T extends Record<string, string>>(
  name: string,
  enumObject: T,
) => {
  const enumValues = Object.values(enumObject);
  return customType<{ data: T[keyof T]; driverData: string }>({
    dataType() {
      return "text";
    },
    toDriver(value: T[keyof T]) {
      if (!enumValues.includes(value)) {
        throw new DrizzleError({
          message: `Invalid value '${value}' for database column ${name}`,
        });
      }
      return value;
    },
    fromDriver(value: string) {
      if (!enumValues.includes(value)) {
        throw new DrizzleError({
          message: `Invalid value '${value}' read from database column ${name}`,
        });
      }
      return value as T[keyof T];
    },
  })(name);
};
