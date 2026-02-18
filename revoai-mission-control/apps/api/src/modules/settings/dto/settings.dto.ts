import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateSafetyDto {
  @IsOptional() @IsBoolean() dryRunEnabled?: boolean;
  @IsOptional() @IsObject() outboundChannels?: { email?: boolean; facebook?: boolean; instagram?: boolean; linkedin?: boolean };
  @IsOptional() @IsBoolean() globalPause?: boolean;
}
