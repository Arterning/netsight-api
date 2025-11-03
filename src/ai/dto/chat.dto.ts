import { IsString, IsNotEmpty } from 'class-validator';

export class ChatDto {
  @IsString()
  @IsNotEmpty({ message: '问题不能为空' })
  question: string;
}
