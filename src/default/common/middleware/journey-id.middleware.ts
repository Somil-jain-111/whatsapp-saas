// src/default/common/middleware/journey-id.middleware.ts

import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { LocalStorageContextUtil } from "../utils/local-storage.util";
import { ContextType } from "../constants/context.option";

@Injectable()
export class JourneyIdMiddleware implements NestMiddleware {
  use(
    req: Request & { journeyId?: string },
    res: Response,
    next: NextFunction,
  ) {
    const supplied = String(
      req.headers["x-journey-id"] || req.headers["x-request-id"] || "",
    );
    const journeyId = /^[a-zA-Z0-9._-]{1,100}$/.test(supplied)
      ? supplied
      : randomUUID();

    req.journeyId = journeyId;
    res.setHeader("x-journey-id", journeyId);

    LocalStorageContextUtil.run(() => {
      LocalStorageContextUtil.set(ContextType.JOURNEY_ID, journeyId);
      next();
    });
  }
}
