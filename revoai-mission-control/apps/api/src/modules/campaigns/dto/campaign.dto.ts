import { IsArray, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsString() name!: string;
  @IsString() niche!: string;
  @IsOptional() @IsString() subNiche?: string;
  @IsString() geography!: string;
  @IsOptional() @IsString() geographyCity?: string;
  @IsOptional() @IsString() geographyRadius?: string;
  @IsOptional() @IsString() geographyRegion?: string;
  @IsOptional() @IsArray() companySize?: string[];
  @IsOptional() @IsString() revenueRange?: string;
  @IsOptional() @IsArray() contactType?: string[];
  @IsOptional() @IsArray() hasContactInfo?: string[];
  @IsOptional() @IsString() defaultChannel?: string;
  @IsOptional() @IsInt() @Min(1) dailySendLimit?: number;
  @IsOptional() @IsObject() dataSources?: any;
  @IsOptional() @IsObject() spreadsheetData?: any;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() painPoint?: string;
  @IsOptional() @IsString() yourOffer?: string;
  @IsOptional() @IsString() yourProof?: string;
  @IsOptional() @IsString() emailSubjectTemplate?: string;
  @IsOptional() @IsString() emailBodyTemplate?: string;
  @IsOptional() emailAiGenerate?: boolean;
  @IsOptional() @IsString() dmBodyTemplate?: string;
  @IsOptional() dmAiGenerate?: boolean;
  @IsOptional() followupEnabled?: boolean;
  @IsOptional() followupSequence?: any;
  @IsOptional() @IsString() sendWindowFrom?: string;
  @IsOptional() @IsString() sendWindowTo?: string;
  @IsOptional() @IsArray() sendDays?: string[];
  @IsOptional() @IsString() status?: string;
}
