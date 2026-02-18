import { IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLeadDto {
  @IsUUID() campaignId!: string;
  @IsString() businessName!: string;
  @IsOptional() @IsString() niche?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() contactRole?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() source?: string;
}

export class OverrideLeadScoreDto {
  @IsEnum(['A','B','C']) score!: 'A'|'B'|'C';
  @IsString() reason!: string;
}
