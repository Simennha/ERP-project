import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * Validates/parses a value against a zod schema (from @erp/contracts) and
 * returns the typed, parsed result. Use at the parameter level:
 *
 *   @Body(new ZodValidationPipe(loginSchema)) body: LoginInput
 *
 * The app also enables the standard class-validator ValidationPipe globally
 * for any future class-based DTOs; the two do not conflict because the global
 * pipe skips values whose metatype is a plain object.
 *
 * Schema param is typed `ZodType<T, ZodTypeDef, any>` rather than `ZodSchema<T>`
 * (= `ZodType<T, ZodTypeDef, T>`) because schemas with `.default()` (e.g.
 * pagination's `page`/`pageSize`) have an Input type that differs from their
 * Output type T (fields are optional on input, required on output) — only the
 * parsed Output shape matters here, so the Input type is left unconstrained.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T, ZodTypeDef, any>) {}

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
