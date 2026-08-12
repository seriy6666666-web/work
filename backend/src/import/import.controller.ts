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

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLANNER)
@Controller('import')
export class ImportController {
  constructor(private importService: ImportService) {}

  @Post('competency')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  competency(@UploadedFile() file: Express.Multer.File, @Query('dryRun') dryRun?: string) {
    return this.importService.importCompetency(requireFile(file).buffer, isDryRun(dryRun));
  }

  @Post('norms')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  norms(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
    @Query('defaultSite') defaultSite?: string,
  ) {
    return this.importService.importNorms(requireFile(file).buffer, isDryRun(dryRun), defaultSite);
  }
}
