import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSchedulerJobDto {
  @IsOptional() @IsUUID() campaignId?: string;
  @IsString() name!: string;
  @IsString() cronExpr!: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
