import { IsIn, IsObject } from "class-validator";

export class TemplateComponentDto {
  @IsIn(["HEADER", "BODY", "FOOTER", "BUTTONS"])
  type!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
