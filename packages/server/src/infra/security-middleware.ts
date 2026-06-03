/**
 * Security & Performance Middleware for Duster v0.8
 * Implements common web security headers and rate limiting
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Register comprehensive security headers
 */
export function registerSecurityHeaders(app: FastifyInstance): void {
  app.addHook("onSend", async (_request, reply) => {
    // Prevent clickjacking
    reply.header("X-Frame-Options", "DENY");

    // Enable XSS protection
    reply.header("X-XSS-Protection", "1; mode=block");

    // Prevent MIME type sniffing
    reply.header("X-Content-Type-Options", "nosniff");

    // Content Security Policy (strict)
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss:; frame-ancestors 'none';"
    );

    // Referrer Policy
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Strict Transport Security (if HTTPS)
    if (process.env.NODE_ENV === "production") {
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    // Permissions Policy
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
    );
  });
}

/**
 * Per-admin rate limiting (prevents brute force / DoS)
 */
export async function registerRateLimiting(app: FastifyInstance): Promise<void> {
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) return; // Skip for unauthenticated

    const adminId = request.user.sub as string;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 300; // 300 requests per minute per admin

    const current = requestCounts.get(adminId);
    if (current && current.resetAt > now) {
      current.count++;
      if (current.count > maxRequests) {
        throw app.httpErrors.tooManyRequests("Rate limit exceeded");
      }
    } else {
      requestCounts.set(adminId, { count: 1, resetAt: now + windowMs });
    }

    // Cleanup old entries
    if (requestCounts.size > 10000) {
      for (const [id, data] of requestCounts.entries()) {
        if (data.resetAt <= now) {
          requestCounts.delete(id);
        }
      }
    }
  });
}

/**
 * Request validation middleware
 */
export function validateRequestSize(app: FastifyInstance): void {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const contentLength = request.headers["content-length"];
    if (contentLength) {
      const size = parseInt(contentLength);
      const maxSize = 10 * 1024 * 1024; // 10MB max
      if (size > maxSize) {
        throw app.httpErrors.payloadTooLarge("Request body too large");
      }
    }
  });
}

/**
 * Sanitize request body to prevent injection attacks
 */
export function sanitizeRequestBody(input: unknown): unknown {
  if (typeof input === "string") {
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeRequestBody);
  }

  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeRequestBody(key) as string] = sanitizeRequestBody(value);
    }
    return sanitized;
  }

  return input;
}

/**
 * Enhanced error handler with secure response
 */
export function registerEnhancedErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(async (error, request, reply) => {
    const requestId = crypto.randomUUID();

    // Log error details (sensitive info NOT exposed to client)
    console.error(`[${requestId}] Error:`, {
      method: request.method,
      url: request.url,
      adminId: request.user?.sub,
      message: error.message,
      code: error.code,
    });

    // Return safe error response
    const statusCode = error.statusCode || 500;
    const isDevelopment = process.env.NODE_ENV === "development";

    reply.status(statusCode).send({
      error: {
        message: isDevelopment ? error.message : "An error occurred",
        code: error.code || "INTERNAL_ERROR",
        requestId, // For debugging support tickets
        ...(isDevelopment && { stack: error.stack }),
      },
    });
  });
}

/**
 * Response compression and optimization
 */
export async function enableResponseOptimization(app: FastifyInstance): Promise<void> {
  // Add gzip compression via @fastify/compress
  try {
    await app.register(require("@fastify/compress"));
  } catch {
    console.warn("@fastify/compress not available");
  }
}

/**
 * Initialize all security and performance middleware
 */
export async function initializeMiddleware(app: FastifyInstance): Promise<void> {
  registerSecurityHeaders(app);
  await registerRateLimiting(app);
  validateRequestSize(app);
  registerEnhancedErrorHandler(app);
  await enableResponseOptimization(app);
}
