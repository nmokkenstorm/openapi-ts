import { getResolvedInput, sendRequest } from '@hey-api/json-schema-ref-parser';

import { mergeHeaders } from '~/plugins/@hey-api/client-fetch/bundle';
import type {
  Input,
  RequestHookContext,
  ResponseHookContext,
} from '~/types/input';
import type { WatchValues } from '~/types/types';

type SpecResponse = {
  arrayBuffer: ArrayBuffer | undefined;
  error?: never;
  resolvedInput: ReturnType<typeof getResolvedInput>;
  response?: never;
};

type SpecError = {
  arrayBuffer?: never;
  error: 'not-modified' | 'not-ok';
  resolvedInput?: never;
  response: Response;
};

/**
 * @internal
 */
export const getSpec = async ({
  fetchOptions,
  inputPath,
  onPostRequest,
  onPreRequest,
  timeout,
  watch,
}: {
  fetchOptions?: RequestInit;
  inputPath: Input['path'];
  onPostRequest?: (context: ResponseHookContext) => void | Promise<void>;
  onPreRequest?: (context: RequestHookContext) => void | Promise<void>;
  timeout: number | undefined;
  watch: WatchValues;
}): Promise<SpecResponse | SpecError> => {
  const resolvedInput = getResolvedInput({ pathOrUrlOrSchema: inputPath });

  let arrayBuffer: ArrayBuffer | undefined;
  // boolean signals whether the file has **definitely** changed
  let hasChanged: boolean | undefined;
  let response: Response | undefined;

  if (resolvedInput.type === 'url') {
    // do NOT send HEAD request on first run or if unsupported
    if (watch.lastValue && watch.isHeadMethodSupported !== false) {
      const requestHeaders = mergeHeaders(fetchOptions?.headers, watch.headers);
      const startTime = performance.now();

      await onPreRequest?.({
        headers: requestHeaders,
        method: 'HEAD',
        timeout,
        url: resolvedInput.path,
      });

      try {
        const request = await sendRequest({
          fetchOptions: {
            method: 'HEAD',
            ...fetchOptions,
            headers: requestHeaders,
          },
          timeout,
          url: resolvedInput.path,
        });
        const duration = Math.round(performance.now() - startTime);

        await onPostRequest?.({
          duration,
          headers: requestHeaders,
          method: 'HEAD',
          response: request.response,
          timeout,
          url: resolvedInput.path,
        });

        if (request.response.status >= 300) {
          return {
            error: 'not-ok',
            response: request.response,
          };
        }

        response = request.response;
      } catch (error) {
        const duration = Math.round(performance.now() - startTime);

        await onPostRequest?.({
          duration,
          error: error as Error,
          headers: requestHeaders,
          method: 'HEAD',
          response: new Response(error.message),
          timeout,
          url: resolvedInput.path,
        });

        return {
          error: 'not-ok',
          response: new Response(error.message),
        };
      }

      if (response) {
        if (!response.ok && watch.isHeadMethodSupported) {
          // assume the server is no longer running
          // do nothing, it might be restarted later
          return {
            error: 'not-ok',
            response,
          };
        }

        if (watch.isHeadMethodSupported === undefined) {
          watch.isHeadMethodSupported = response.ok;
        }

        if (response.status === 304) {
          return {
            error: 'not-modified',
            response,
          };
        }

        if (hasChanged === undefined) {
          const eTag = response.headers.get('ETag');
          if (eTag) {
            hasChanged = eTag !== watch.headers.get('If-None-Match');
            if (hasChanged) {
              watch.headers.set('If-None-Match', eTag);
            }
          }
        }

        if (hasChanged === undefined) {
          const lastModified = response.headers.get('Last-Modified');
          if (lastModified) {
            hasChanged =
              lastModified !== watch.headers.get('If-Modified-Since');
            if (hasChanged) {
              watch.headers.set('If-Modified-Since', lastModified);
            }
          }
        }

        // we definitely know the input has not changed
        if (hasChanged === false) {
          return {
            error: 'not-modified',
            response,
          };
        }
      }
    }

    const startTime = performance.now();
    const requestHeaders = mergeHeaders(fetchOptions?.headers);

    await onPreRequest?.({
      headers: requestHeaders,
      method: 'GET',
      timeout,
      url: resolvedInput.path,
    });

    try {
      const request = await sendRequest({
        fetchOptions: {
          method: 'GET',
          ...fetchOptions,
        },
        timeout,
        url: resolvedInput.path,
      });
      const duration = Math.round(performance.now() - startTime);

      await onPostRequest?.({
        duration,
        headers: requestHeaders,
        method: 'GET',
        response: request.response,
        timeout,
        url: resolvedInput.path,
      });

      if (request.response.status >= 300) {
        return {
          error: 'not-ok',
          response: request.response,
        };
      }

      response = request.response;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      await onPostRequest?.({
        duration,
        error: error as Error,
        headers: requestHeaders,
        method: 'GET',
        response: new Response(error.message),
        timeout,
        url: resolvedInput.path,
      });

      return {
        error: 'not-ok',
        response: new Response(error.message),
      };
    }

    if (response) {
      if (!response.ok) {
        // assume the server is no longer running
        // do nothing, it might be restarted later
        return {
          error: 'not-ok',
          response,
        };
      }

      arrayBuffer = response.body
        ? await response.arrayBuffer()
        : new ArrayBuffer(0);

      if (hasChanged === undefined) {
        const content = new TextDecoder().decode(arrayBuffer);
        hasChanged = content !== watch.lastValue;
        watch.lastValue = content;
      }
    }
  } else {
    // we do not support watch mode for files or raw spec data
    watch.lastValue = !watch.lastValue ? resolvedInput.type : watch.lastValue;
    hasChanged = watch.lastValue ? false : undefined;
  }

  return hasChanged === false && response
    ? {
        error: 'not-modified',
        response,
      }
    : {
        arrayBuffer,
        resolvedInput,
      };
};
