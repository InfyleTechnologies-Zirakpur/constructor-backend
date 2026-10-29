import { IsString, Matches, MinLength } from 'class-validator';

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;

export class UpdateEngineerPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'Password must include uppercase, lowercase, number and special character',
  })
  password: string;
}
