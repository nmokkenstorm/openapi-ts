import type * as Shared from '@hey-api/shared';

import { ts } from '../../../../../ts-compiler';
import { $ } from '../../../../../ts-dsl';

const printer = ts.createPrinter();
const astToString = (node: Parameters<typeof printer.format>[0]) => printer.format(node).trimEnd();

vi.mock('@hey-api/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof Shared>();
  return {
    ...actual,
    applyNaming: (id: string) => `use${id.charAt(0).toUpperCase()}${id.slice(1)}SuspenseQuery`,
  };
});

const operationUtils = vi.hoisted(() => ({
  hasOperationSse: vi.fn(() => false),
  isOperationOptionsRequired: vi.fn(() => false),
}));

vi.mock('../../../../shared/utils/operation', () => ({
  createOperationComment: () => null,
  ...operationUtils,
}));

vi.mock('../../shared/use-type', () => ({
  useTypeData: () => $.type('Options<FooData>'),
}));

const { createUseSuspenseQuery } = await import('../use-suspense-query');

const buildPlugin = (config: Record<string, unknown>) => {
  const captured: Array<{ toAst: () => never }> = [];
  const plugin = {
    config: { comments: false, ...config },
    context: {},
    imports: { useSuspenseQuery: 'useSuspenseQuery' },
    name: '@tanstack/react-query' as const,
    node: (statement: { toAst: () => never }) => {
      captured.push(statement);
    },
    referenceSymbol: () => 'fooOptions',
    symbol: (name: string) => name,
  };
  return { captured, plugin };
};

const useSuspenseQuery = {
  useSuspenseQuery: { case: 'camelCase', enabled: true, name: 'use{{name}}SuspenseQuery' },
};

describe('createUseSuspenseQuery', () => {
  beforeEach(() => {
    operationUtils.hasOperationSse.mockReturnValue(false);
    operationUtils.isOperationOptionsRequired.mockReturnValue(false);
  });

  it.each([
    ['optional', false, 'options?: Options<FooData>'],
    ['required', true, 'options: Options<FooData>'],
  ])('emits a hook over the query options with %s options', (_, required, param) => {
    operationUtils.isOperationOptionsRequired.mockReturnValue(required);
    const { captured, plugin } = buildPlugin(useSuspenseQuery);
    createUseSuspenseQuery({ operation: { id: 'foo' } as never, plugin: plugin as never });

    expect(captured).toHaveLength(1);
    expect(astToString(captured[0]!.toAst())).toBe(
      `export const useFooSuspenseQuery = (${param}) => useSuspenseQuery(fooOptions(options));`,
    );
  });

  it.each([
    ['useSuspenseQuery is not in the plugin config', {}, false],
    ['the operation streams server-sent events', useSuspenseQuery, true],
  ])('emits nothing when %s', (_, config, sse) => {
    operationUtils.hasOperationSse.mockReturnValue(sse);
    const { captured, plugin } = buildPlugin(config);
    createUseSuspenseQuery({ operation: { id: 'foo' } as never, plugin: plugin as never });

    expect(captured).toHaveLength(0);
  });
});
