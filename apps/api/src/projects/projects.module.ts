import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { DashboardWidgetsModule } from '../core/dashboard-widgets';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectsDashboardWidgetsProvider } from './projects-dashboard-widgets.provider';

/**
 * Projects module — a standalone single-entity stub (Project CRUD only, no
 * cross-module relations yet). Follows the Inventory/Sales reference shape.
 */
@Module({
  imports: [PrismaModule, DashboardWidgetsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsDashboardWidgetsProvider],
})
export class ProjectsModule {}
