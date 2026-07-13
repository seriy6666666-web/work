import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SitesModule } from './sites/sites.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { OperationsModule } from './operations/operations.module';
import { SkillsModule } from './skills/skills.module';
import { CompetencyModule } from './competency/competency.module';
import { DistributionModule } from './distribution/distribution.module';
import { AttendanceModule } from './attendance/attendance.module';
import { MyTasksModule } from './my-tasks/my-tasks.module';
import { AbsencesModule } from './absences/absences.module';
import { TransfersModule } from './transfers/transfers.module';
import { StatsModule } from './stats/stats.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 1000 }]),
    PrismaModule,
    AuthModule,
    SitesModule,
    UsersModule,
    OrdersModule,
    OperationsModule,
    SkillsModule,
    CompetencyModule,
    DistributionModule,
    AttendanceModule,
    MyTasksModule,
    AbsencesModule,
    TransfersModule,
    StatsModule,
    AuditModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
