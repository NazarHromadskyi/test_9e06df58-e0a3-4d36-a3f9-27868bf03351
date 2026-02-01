import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { DateUtils } from '../utils/date.utils';

interface DateRangeObject {
  from_date?: string;
  to_date?: string;
}

/**
 * Validates that to_date is greater than or equal to from_date.
 * Uses DateUtils for consistent UTC handling across all date formats.
 * Works with both date-only (YYYY-MM-DD) and datetime (YYYY-MM-DD HH:mm:ss) formats.
 */
@ValidatorConstraint({ name: 'isDateRangeValid', async: false })
export class IsDateRangeValid implements ValidatorConstraintInterface {
  validate(_value: string, args: ValidationArguments): boolean {
    const obj = args.object as DateRangeObject;
    if (!obj.from_date || !obj.to_date) return true;

    try {
      const from = DateUtils.parseToUtc(obj.from_date);
      const to = DateUtils.parseToUtc(obj.to_date);

      return to >= from;
    } catch {
      // Invalid or unparseable dates must fail validation (e.g. 2024-13-40)
      return false;
    }
  }

  defaultMessage(): string {
    return 'to_date must be greater than or equal to from_date, and both must be valid dates';
  }
}
