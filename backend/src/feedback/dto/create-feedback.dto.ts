import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FeedbackMood, FeedbackType } from '../../generated/prisma/enums';

export class CreateFeedbackDto {
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @IsOptional()
  @IsEnum(FeedbackMood)
  mood?: FeedbackMood;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  /** Путь экрана, с которого написали — подставляет фронт. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  screen?: string;

  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;
}
