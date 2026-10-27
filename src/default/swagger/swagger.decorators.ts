import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SwaggerErrorResponseDto } from "./swagger.dto";

const ACCESS_TOKEN_SCHEME = "access-token";

/** Common controller documentation matching the application's error contract. */
export function ApiControllerDocs(
  tag: string,
  authenticated = false,
): ClassDecorator {
  const decorators: Array<ClassDecorator | MethodDecorator> = [
    ApiTags(tag),
    ApiBadRequestResponse({
      description: "Invalid request",
      type: SwaggerErrorResponseDto,
    }),
    ApiInternalServerErrorResponse({
      description: "Unexpected server error",
      type: SwaggerErrorResponseDto,
    }),
  ];

  if (authenticated) {
    decorators.push(
      ApiBearerAuth(ACCESS_TOKEN_SCHEME),
      ApiUnauthorizedResponse({
        description: "Access token is missing or invalid",
        type: SwaggerErrorResponseDto,
      }),
      ApiForbiddenResponse({
        description: "The authenticated user lacks permission",
        type: SwaggerErrorResponseDto,
      }),
    );
  }

  return applyDecorators(...decorators) as ClassDecorator;
}

/** Adds searchable operation metadata and method-level authentication where required. */
export function ApiEndpoint(
  summary: string,
  authenticated = false,
  description?: string,
): MethodDecorator {
  const decorators: Array<ClassDecorator | MethodDecorator> = [
    ApiOperation({ summary, description }),
  ];

  if (authenticated) {
    decorators.push(
      ApiBearerAuth(ACCESS_TOKEN_SCHEME),
      ApiUnauthorizedResponse({
        description: "Access token is missing or invalid",
        type: SwaggerErrorResponseDto,
      }),
      ApiForbiddenResponse({
        description: "The authenticated user lacks permission",
        type: SwaggerErrorResponseDto,
      }),
    );
  }

  return applyDecorators(...decorators) as MethodDecorator;
}
