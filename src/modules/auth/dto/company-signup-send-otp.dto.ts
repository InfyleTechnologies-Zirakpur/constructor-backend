import { IsEmail, IsIn, IsNotEmpty, IsString, Length } from 'class-validator';

export class CompanySignupSendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  name: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsIn(['company'], {
    message: "Only 'company' role can use this signup",
  })
  role: string = 'company';
}
