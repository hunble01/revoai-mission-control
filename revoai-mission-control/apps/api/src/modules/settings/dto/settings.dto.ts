import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateSafetyDto {
  @IsOptional() @IsBoolean() dryRunEnabled?: boolean;
  @IsOptional() @IsObject() outboundChannels?: { email?: boolean; facebook?: boolean; instagram?: boolean; linkedin?: boolean };
  @IsOptional() @IsObject() outboundKillSwitches?: { email?: boolean; facebook?: boolean; instagram?: boolean; linkedin?: boolean };
  @IsOptional() @IsObject() outboundDailyCaps?: { email?: number; facebook?: number; instagram?: number; linkedin?: number };
  @IsOptional() @IsBoolean() globalPause?: boolean;
}
