import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const allowedOrigins: (string | RegExp)[] = [
    'https://trustana-cms.vercel.app',
    /\.vercel\.app$/,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

export function isAllowed(origin: string) {
    return allowedOrigins.some(r => r instanceof RegExp ? r.test(origin) : r === origin);
}

export const corsOptions: CorsOptions = {
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);            // allow curl and server to server
        if (isAllowed(origin)) return cb(null, true);  // allow known origins
        return cb(null, false);                        // deny CORS without throwing
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-ID', 'X-Requested-With'],
    optionsSuccessStatus: 204,
};