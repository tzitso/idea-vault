import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { ApiResponse } from "@/types/index.types";
import { StatusCode } from "hono/utils/http-status";

export class HttpError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorHandler(err: Error, c: Context): Response {
    console.error("Error:", err);
  
    if (err instanceof HttpError) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: err.message,
        },
        err.statusCode as any
      );
    }
  
    if (err instanceof HTTPException) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: err.message,
        },
        err.status as any
      );
    }
  
    if (err instanceof ZodError) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Validation failed",
          details: err.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400 as any
      );
    }
  
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Internal server error",
      },
      500 as any
    );
  }
