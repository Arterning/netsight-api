import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateKnowledgeDto {
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: '内容不能为空' })
  content: string;
}

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '内容不能为空' })
  content?: string;
}
