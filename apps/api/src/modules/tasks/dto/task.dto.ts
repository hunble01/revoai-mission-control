import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTaskDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsEnum(['BACKLOG','DOING','NEEDS_APPROVAL','DONE']) columnName?: 'BACKLOG'|'DOING'|'NEEDS_APPROVAL'|'DONE';
  @IsOptional() @IsString() priority?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['BACKLOG','DOING','NEEDS_APPROVAL','DONE']) columnName?: 'BACKLOG'|'DOING'|'NEEDS_APPROVAL'|'DONE';
  @IsOptional() @IsString() priority?: string;
}
