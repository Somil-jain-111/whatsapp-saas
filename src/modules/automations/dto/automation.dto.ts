import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { WorkflowEdge, WorkflowNode } from "../workflow.types";

export class CreateWorkflowDto {
  @IsString() @Length(1, 150) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
export class UpdateWorkflowDto {
  @IsOptional() @IsString() @Length(1, 150) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsObject() triggerConfig?: Record<string, any>;
  @IsOptional() @IsArray() nodes?: WorkflowNode[];
  @IsOptional() @IsArray() edges?: WorkflowEdge[];
  @Type(() => Number) @IsInt() @Min(1) revision!: number;
}
export class ListWorkflowDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ACTIVE", "PAUSED", "ARCHIVED"])
  status?: string;
}
export class ChatbotRuleDto {
  @IsString() @Length(1, 120) name!: string;
  @IsIn(["EXACT", "NORMALIZED", "CONTAINS"]) matchType!: string;
  @IsArray() keywords!: string[];
  @IsIn(["SESSION_MESSAGE", "TEMPLATE", "INTERACTIVE", "AGENT_HANDOFF"])
  responseType!: string;
  @IsObject() responseConfig!: Record<string, any>;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) priority = 100;
  @IsBoolean() isFallback = false;
  @IsBoolean() active = true;
}
export class CredentialDto {
  @IsString() @Length(1, 100) name!: string;
  @IsString() @Length(1, 100) headerName!: string;
  @IsString() @Length(1, 4096) secret!: string;
}
export class SandboxDto {
  @IsObject() payload!: Record<string, any>;
  @IsOptional() @IsObject() variables: Record<string, any> = {};
}
export class ExecutionListDto {
  @IsOptional()
  @IsIn(["PENDING", "RUNNING", "WAITING", "COMPLETED", "FAILED", "CANCELLED"])
  status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
export class VersionParamDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}
export class ExternalAutomationEventDto {
  @IsString() @Length(1, 255) eventId!: string;
  @IsString() @Length(1, 60) eventType!: string;
  @IsObject() payload!: Record<string, any>;
  @IsOptional() @IsDateString() timestamp?: string;
}
