import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates/parses a value against a zod schema (from @erp/contracts) and
 * returns the typed, parsed result. Use at the parameter level:
 *
 *   @Body(new ZodValidationPipe(loginSchema)) body: LoginInput
 *
 * The app also enables the standard class-validator ValidationPipe globally
 * for any future class-based DTOs; the two do not conflict because the global
 * pipe skips values whose metatype is a plain object.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        error: 'BadRequest',
        details: result.error.flatten(),
      });
    }
    return result.data;
  }
}
