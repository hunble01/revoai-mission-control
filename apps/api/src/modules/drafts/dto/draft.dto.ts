import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDraftDto {
  @IsUUID() campaignId!: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsEnum(['EMAIL','FACEBOOK','INSTAGRAM','LINKEDIN']) channel!: 'EMAIL'|'FACEBOOK'|'INSTAGRAM'|'LINKEDIN';
  @IsString() draftType!: string;
  @IsOptional() @IsString() content?: string;
}

export class UpdateDraftDto {
  @IsOptional() @IsString() draftType?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsEnum(['DRAFT','NEEDS_APPROVAL','APPROVED','REJECTED']) status?: 'DRAFT'|'NEEDS_APPROVAL'|'APPROVED'|'REJECTED';
}
