import type { IR } from '@hey-api/shared';
import { applyNaming } from '@hey-api/shared';

import {
  createOperationComment,
  hasOperationSse,
  isOperationOptionsRequired,
} from '../../../../plugins/shared/utils/operation';
import { $ } from '../../../../ts-dsl';
import { useTypeData } from '../shared/useType';
import type { PluginInstance } from '../types';

const optionsParamName = 'options';
const queryOptionsParamName = 'queryOptions';

export const createUseQuery = ({
  operation,
  plugin,
}: {
  operation: IR.OperationObject;
  plugin: PluginInstance;
}): void => {
  if (hasOperationSse({ operation })) {
    return;
  }

  if (!('useQuery' in plugin.config)) {
    return;
  }

  const symbolUseQueryFn = plugin.symbol(applyNaming(operation.id, plugin.config.useQuery));

  const symbolUseQuery = plugin.external(`${plugin.name}.useQuery`);

  const isRequiredOptions = isOperationOptionsRequired({
    context: plugin.context,
    operation,
  });
  const typeData = useTypeData({ operation, plugin });

  const hasSkipToken = 'skipToken' in plugin.config && plugin.config.skipToken;
  const symbolSkipToken = hasSkipToken ? plugin.external(`${plugin.name}.skipToken`) : undefined;
  const paramType = symbolSkipToken
    ? $.type.or(typeData, $.type.query($(symbolSkipToken)))
    : typeData;

  const symbolQueryOptionsFn = plugin.referenceSymbol({
    category: 'hook',
    resource: 'operation',
    resourceId: operation.id,
    role: 'queryOptions',
    tool: plugin.name,
  });

  const queryOptionsReturnType = $.type('Partial').generic(
    $.type('Omit', (t) =>
      t.generics(
        $(symbolQueryOptionsFn).returnType(),
        $.type.or($.type.literal('queryKey'), $.type.literal('queryFn')),
      ),
    ),
  );

  const statement = $.const(symbolUseQueryFn)
    .export()
    .$if(plugin.config.comments && createOperationComment(operation), (c, v) => c.doc(v))
    .assign(
      $.func()
        .param(optionsParamName, (p) => p.required(isRequiredOptions).type(paramType))
        .param(queryOptionsParamName, (p) => p.optional().type(queryOptionsReturnType))
        .do(
          $(symbolUseQuery)
            .call(
              $.object()
                .spread($(symbolQueryOptionsFn).call(optionsParamName))
                .spread(queryOptionsParamName),
            )
            .return(),
        ),
    );
  plugin.node(statement);
};
