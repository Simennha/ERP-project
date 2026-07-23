import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Users domain module. For this phase it only exposes read helpers used by
 * auth and the RBAC guard; user CRUD endpoints arrive in a later phase.
 */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
