export class Formatter {
  static toStringOrEmpty(
    value?: { toString(): string } | string | number | null,
  ): string {
    return value === null || value === undefined ? "" : value.toString();
  }

  static toIsoStringOrEmpty(value?: Date | null): string {
    return value ? value.toISOString() : "";
  }

  /**
   * Safely formats data as a JSON string if it is an object.
   * If the input is already a string, returns it as-is.
   *
   * @param data The data to format.
   * @param trueObject If true, formats with indentation (pretty print).
   * @returns A JSON string or the original input if not an object.
   */
  static safeStringify(data: any, trueObject: boolean = false): string {
    if (typeof data === "object" && data !== null) {
      return trueObject ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    }
    return String(data); // Convert non-object data to string
  }

  /**
   * Formats a stack trace string into an array of lines for better readability.
   * If the input is not a string, it returns null.
   *
   * @param trace The raw stack trace string to format.
   * @returns An array of stack trace lines or null if the input is invalid.
   */
  static formatStackTrace(trace: string): string[] | null {
    if (typeof trace !== "string") {
      return null; // Return null if trace is not a string
    }

    return trace
      .split("\n") // Split by newline
      .map((line) => line.trim()) // Trim each line
      .filter((line) => line.length > 0); // Remove empty lines
  }

  /**
   * Converts a string to sentence case.
   * Supports optional capitalization of every word.
   *
   * @param input The input string to format.
   * @param options Configuration options:
   * - capitalize: If true, capitalizes every word.
   * - translate: If true, translates the string using i18next.
   * - lng: Language for translation (if `translate` is true).
   * @returns The formatted string.
   */
  static formatString(
    input: string,
    options?: { capitalize?: boolean; translate?: boolean; lang?: string },
  ): string {
    const { capitalize = false, translate = false } = options || {};

    let result = input;

    // Step 1: Apply translation if enabled
    if (translate) {
      // result = i18next.t(input, { lang });
    }

    // Step 2: Capitalize every word if the `capitalize` option is enabled
    if (capitalize) {
      result = result
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ");
    } else {
      // Step 3: Otherwise, convert to sentence case
      result = result
        .split(/\.|!|\?/) // Split by sentence-ending punctuation
        .map((sentence) => sentence.trim()) // Remove leading/trailing spaces
        .filter((sentence) => sentence.length > 0) // Remove empty sentences
        .map(
          (sentence) =>
            sentence.charAt(0).toUpperCase() + sentence.slice(1).toLowerCase(),
        ) // Capitalize the first letter of each sentence
        .join(". "); // Rejoin sentences with period and space
    }

    return result;
  }
}
