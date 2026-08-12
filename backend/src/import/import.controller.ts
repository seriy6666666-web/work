import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import { ImportService } from './import.service';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // рабочие файлы бывают по нескольку МБ

/** По умолчанию — только предпросмотр; запись в базу требует явного dryRun=false. */
function isDryRun(value?: string): boolean {
  return value !== 'false';
}

function requireFile(file?: Express.Multer.File): Express.Multer.File {
  if (!file) throw new BadRequestException('Файл не приложен');
  // Старый бинарный .xls парсер (exceljs) не читает. Раньше он проходил проверку
  // имени и падал потом на разборе с невнятным «не удалось разобрать файл».
  if (/\.xls$/i.test(file.originalname)) {
    throw new BadRequestException(
      'Формат .xls не поддерживается. Откройте файл в Excel и сохраните как .xlsx («Книга Excel»).',
    );
  }
  if (!/\.xlsx$/i.test(file.originalname)) {
    throw new BadRequestException('Ожидается файл Excel (.xlsx)');
  }
  return file;
}

const upload = () => UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }));

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('import')
export class ImportController {
  constructor(private importService: ImportService) {}

  /**
   * Заведение сотрудников из матрицы компетенций — вместе с паролями для раздачи.
   * Только администратор: по ТЗ учётные записи и роли — его зона, а планировщику
   * закрыт даже список сотрудников. Раньше этот же файл грузил планировщик и
   * получал на экран пароли всех заведённых людей.
   */
  @Post('employees')
  @Roles(Role.ADMIN)
  @upload()
  employees(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    return this.importService.importCompetency(requireFile(file).buffer, isDryRun(dryRun), true);
  }

  /**
   * Навыки и компетенции по тому же файлу, но без создания учётных записей:
   * незнакомые ФИО возвращаются списком в замечаниях. Планировщику этого достаточно —
   * матрица компетенций его рабочий документ.
   */
  @Post('competency')
  @Roles(Role.PLANNER, Role.ADMIN)
  @upload()
  competency(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    return this.importService.importCompetency(requireFile(file).buffer, isDryRun(dryRun), false);
  }

  @Post('norms')
  @Roles(Role.PLANNER, Role.ADMIN)
  @upload()
  norms(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
    @Query('defaultSite') defaultSite?: string,
  ) {
    return this.importService.importNorms(requireFile(file).buffer, isDryRun(dryRun), defaultSite);
  }
}
