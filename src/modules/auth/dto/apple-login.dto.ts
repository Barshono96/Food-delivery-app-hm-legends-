import { IsString, IsNotEmpty } from "class-validator";

export class AppleLoginDto {
    @IsString()
    @IsNotEmpty()
    type: 'admin' | 'manager' | 'driver';

    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @IsNotEmpty()
    fcm_token: string;
}
