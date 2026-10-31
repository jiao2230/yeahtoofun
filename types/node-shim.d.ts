// Minimal Node type declarations for the local prototype.
// The project has no node_modules / @types/node; this covers only the APIs
// actually used by src/ and test/. It is intentionally not a full Node typings
// package. If @types/node is installed later, remove this file.

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit(code?: number): never;
  stdout: { write(text: string): void };
  stderr: { write(text: string): void };
};

interface Buffer extends Uint8Array {
  toString(encoding?: string): string;
}
declare const Buffer: {
  isBuffer(value: unknown): value is Buffer;
  from(value: string | Uint8Array): Buffer;
  concat(chunks: Buffer[]): Buffer;
  byteLength(value: string): number;
};

declare class URL {
  constructor(input: string, base?: string);
  pathname: string;
  hostname: string;
  host: string;
}

declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
  export function writeFileSync(path: string | URL, data: string, encoding?: 'utf8'): void;
  export function existsSync(path: string | URL): boolean;
}

declare module 'node:http' {
  export interface IncomingMessage extends AsyncIterable<Uint8Array> {
    method?: string;
    url?: string;
    headers: Record<string, string | undefined>;
  }

  export interface ServerResponse {
    headersSent: boolean;
    setHeader(name: string, value: string | number): void;
    writeHead(status: number, headers?: Record<string, string | number>): void;
    write(chunk: string): void;
    end(chunk?: string): void;
    destroy(): void;
  }

  export interface Server {
    listen(port: number, host: string, callback?: () => void): void;
    close(callback?: () => void): void;
    address(): { port: number } | null;
  }

  export function createServer(
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
  ): Server;
}

declare module 'node:url' {
  export { URL };
}

declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  const assert: {
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    throws(fn: () => void, expected?: RegExp): void;
  };
  export default assert;
}
