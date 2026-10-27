import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class NotFoundMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (!req.route) {
      res.status(404).json({
        status: false,
        code: 404,
        message: "Invalid path",
        data: null,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
      });

      return;
    }

    next();
  }
}
