import 'express-serve-static-core';
import type { Types } from 'mongoose';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
    auth?: { userId: Types.ObjectId; sessionId: Types.ObjectId };
  }
}
