import { IsOptional, IsString } from 'class-validator';

export class ApprovalActionDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() content?: string;
}
