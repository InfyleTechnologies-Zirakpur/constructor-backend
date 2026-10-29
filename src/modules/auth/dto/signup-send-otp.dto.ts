import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class SignupSendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone must be a valid 10-digit Indian mobile number',
  })
  phone: string;

  @IsOptional()
  @IsIn(['job_seeker'], {
    message: "Only 'job_seeker' role can self-signup",
  })
  role?: string = 'job_seeker';

  @IsArray()
  @ArrayNotEmpty({ message: 'At least one skill is required' })
  @IsString({ each: true })
  @Length(2, 60, { each: true })
  skill: string[];
}
