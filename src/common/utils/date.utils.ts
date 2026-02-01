import { DateTime } from 'luxon';

type ParserEntry = {
  test: (value: string) => boolean;
  parse: (value: string) => DateTime;
};

export class DateUtils {
  private static readonly DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly DATETIME_SPACE_REGEX =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  private static readonly ISO_8601_REGEX =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/;
  private static readonly DATE_ONLY_FORMAT = 'yyyy-MM-dd';
  private static readonly DATETIME_SPACE_FORMAT = 'yyyy-MM-dd HH:mm:ss';

  private static readonly PARSERS: ParserEntry[] = [
    {
      test: (s) => this.DATE_ONLY_REGEX.test(s),
      parse: (s) => this.parseDateOnlyValue(s),
    },
    {
      test: (s) => this.DATETIME_SPACE_REGEX.test(s),
      parse: (s) => this.parseDateTimeValue(s),
    },
    {
      test: (s) => this.ISO_8601_REGEX.test(s),
      parse: (s) => this.parseIsoValue(s),
    },
  ];

  private static hasTimeZone(value: string): boolean {
    return /(Z|[+-]\d{2}:\d{2})$/.test(value);
  }

  private static assertValid(dt: DateTime, value: string): DateTime {
    if (!dt.isValid) {
      throw new Error(`Invalid date value: ${value}`);
    }
    return dt;
  }

  private static formatUtcIso(dt: DateTime, value: string): string {
    const iso = dt.toUTC().toISO({ suppressMilliseconds: false });
    if (!iso) {
      throw new Error(`Failed to format date value: ${value}`);
    }
    return iso;
  }

  private static parseDateOnlyValue(value: string): DateTime {
    return this.assertValid(
      DateTime.fromFormat(value, this.DATE_ONLY_FORMAT, { zone: 'utc' }),
      value,
    );
  }

  private static parseDateTimeValue(value: string): DateTime {
    return this.assertValid(
      DateTime.fromFormat(value, this.DATETIME_SPACE_FORMAT, { zone: 'utc' }),
      value,
    );
  }

  private static parseIsoValue(value: string): DateTime {
    const options = this.hasTimeZone(value)
      ? { setZone: true }
      : { zone: 'utc' };
    return this.assertValid(DateTime.fromISO(value, options), value);
  }

  /**
   * Parses a date string to a Date object in UTC.
   * Supports formats:
   * - "YYYY-MM-DD" (date only, treated as start of day UTC)
   * - "YYYY-MM-DD HH:mm:ss" (datetime, treated as UTC)
   * - ISO 8601 format
   *
   * @throws Error if the date format is invalid or unrecognized
   */
  static parseToUtc(value: string): Date {
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid date value: expected non-empty string');
    }

    const trimmed = value.trim();
    const entry = this.PARSERS.find((e) => e.test(trimmed));

    if (!entry) {
      throw new Error(`Unsupported date format: ${trimmed}`);
    }

    return entry.parse(trimmed).toJSDate();
  }

  /**
   * Converts a datetime string to UTC ISO format.
   * "2024-01-01 12:00:00" -> "2024-01-01T12:00:00.000Z"
   */
  static toUtcDateTimeString(datetime: string): string {
    const trimmed = datetime.trim();
    if (!this.DATETIME_SPACE_REGEX.test(trimmed)) {
      throw new Error(
        `Expected datetime format (YYYY-MM-DD HH:mm:ss): ${datetime}`,
      );
    }

    const dt = this.parseDateTimeValue(trimmed);
    return this.formatUtcIso(dt, trimmed);
  }
}
