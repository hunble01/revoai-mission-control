import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString() name!: string;
  @IsString() niche!: string;
  @IsString() geography!: string;
  @IsOptional() @IsEnum(['A','B','C']) minScore?: 'A'|'B'|'C';
}
