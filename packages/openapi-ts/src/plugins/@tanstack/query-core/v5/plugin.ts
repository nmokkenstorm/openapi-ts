import type { PluginHandler } from '../types';
import { createInfiniteQueryOptions } from './infiniteQueryOptions';
import { createMutationOptions } from './mutationOptions';
import { createQueryOptions } from './queryOptions';
import { createUseMutation } from './useMutation';
import { createUseQuery } from './useQuery';

export const handlerV5: PluginHandler = ({ plugin }) => {
  plugin.symbol('DefaultError', {
    external: plugin.name,
    kind: 'type',
    meta: {
      category: 'external',
      resource: `${plugin.name}.DefaultError`,
    },
  });
  plugin.symbol('InfiniteData', {
    external: plugin.name,
    kind: 'type',
    meta: {
      category: 'external',
      resource: `${plugin.name}.InfiniteData`,
    },
  });
  plugin.symbol(plugin.config.mutationOptionsTypeName, {
    external: plugin.name,
    kind: 'type',
    meta: {
      category: 'external',
      resource: `${plugin.name}.MutationOptions`,
    },
  });
  plugin.symbol('infiniteQueryOptions', {
    external: plugin.name,
    meta: {
      category: 'external',
      resource: `${plugin.name}.infiniteQueryOptions`,
    },
  });
  plugin.symbol('queryOptions', {
    external: plugin.name,
    meta: {
      category: 'external',
      resource: `${plugin.name}.queryOptions`,
    },
  });
  plugin.symbol('useMutation', {
    external: plugin.name,
    meta: {
      category: 'external',
      resource: `${plugin.name}.useMutation`,
    },
  });
  plugin.symbol('useQuery', {
    external: plugin.name,
    meta: {
      category: 'external',
      resource: `${plugin.name}.useQuery`,
    },
  });
  plugin.symbol(plugin.config.queryOptionsTypeName, {
    external: plugin.name,
    kind: 'type',
    meta: {
      category: 'external',
      resource: `${plugin.name}.QueryObserverOptions`,
    },
  });
  plugin.symbol('AxiosError', {
    external: 'axios',
    kind: 'type',
    meta: {
      category: 'external',
      resource: 'axios.AxiosError',
    },
  });

  plugin.forEach(
    'operation',
    ({ operation }) => {
      if (plugin.hooks.operation.isQuery(operation)) {
        if (plugin.config.queryOptions.enabled) {
          createQueryOptions({ operation, plugin });
        }

        if (plugin.config.infiniteQueryOptions.enabled) {
          createInfiniteQueryOptions({ operation, plugin });
        }

        if ('useQuery' in plugin.config && plugin.config.useQuery.enabled) {
          createUseQuery({ operation, plugin });
        }
      }

      if (plugin.hooks.operation.isMutation(operation)) {
        if (plugin.config.mutationOptions.enabled) {
          createMutationOptions({ operation, plugin });
        }

        if ('useMutation' in plugin.config && plugin.config.useMutation.enabled) {
          createUseMutation({ operation, plugin });
        }
      }
    },
    {
      order: 'declarations',
    },
  );
};
