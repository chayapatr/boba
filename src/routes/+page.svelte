<script lang="ts">
	// @ts-nocheck
	import { BOBA } from '$lib';
	import type { ASTNode } from '$lib/boba/parser/generator';
	import Editor from '$lib/components/Editor.svelte';
	import { source } from '$lib/store';

	$: result = BOBA($source);

	const ASTtoString = (ast: ASTNode | undefined) => {
		if (!ast) return '';
		const level = 0;
		const dfs = (node: ASTNode, level: number, prefix: string) => {
			switch (node.type as string) {
				case 'LITERAL':
					return `<br/>${prefix}⊢ VALUE: ${node.expr}`;
				case 'BINARY':
					return `<br/>${prefix}⊢ BIN (${node.opr.lexeme})
					${dfs(node.left, level + 1, prefix + '&nbsp;&nbsp;')}
					${dfs(node.right, level + 1, prefix + '&nbsp;&nbsp;')}`;
				case 'GROUPING':
					return `<br/>${prefix}⊢ [GROUP]
					${dfs(node.expr, level + 1, prefix + '&nbsp&nbsp;')}`;
				case 'UNARY':
					return `<br/>${prefix}⊢ UNARY (${node.opr.lexeme})${dfs(node.right, level + 1, prefix + '&nbsp&nbsp;')}`;
			}
		};
		const result = dfs(ast, level, '');
		return '<span class="font-semibold">PROGRAM</span>' + result;
	};
</script>

<div class="grid h-[100svh] gap-3 p-3 font-mono md:grid-cols-2 md:gap-4 md:p-4">
	<div class="h-[calc(50svh-0.75rem)] md:h-[calc(100svh-2rem)]">
		<Editor {result} />
	</div>

	<div
		class="flex h-[calc(50svh-1.5rem)] flex-col gap-3 text-xs md:h-[calc(100vh-2rem)] md:gap-4 md:text-sm"
	>
		<ul class="flex h-1/2 flex-col overflow-y-scroll rounded-md border bg-gray-50 p-4">
			<div class="mb-1 font-semibold">
				<span class={result.scanned.success ? 'text-emerald-600' : 'text-red-600'}
					>{result.scanned.success ? '[SCANNING SUCCESS]' : `[ERROR: ${result.scanned.msg}]`}</span
				>
			</div>
			<li class="mb-1 grid grid-cols-4 gap-3 font-semibold">
				<div class=" text-neutral-800">TYPE</div>
				<div>LEXEME</div>
				<div>LITERAL</div>
				<div>LINE</div>
			</li>
			<div class="mb-1 w-full border-t border-neutral-400"></div>
			{#each result.scanned.tokens.filter((token) => !['NEWLINE', 'SPACE'].includes(token.type)) || [] as token}
				<li class="grid grid-cols-4 gap-3">
					<div class=" text-neutral-800">{token.type}</div>
					<div class="w-full overflow-x-clip">{token.lexeme}</div>
					<div class={`${token.literal ?? 'text-neutral-400'}`}>{token.literal}</div>
					<div>{token.line}</div>
				</li>
			{/each}
		</ul>
		<div class="flex h-1/2 flex-col overflow-scroll rounded-md border bg-gray-50 p-4">
			<div class="mb-1 font-semibold">
				<span class={!result.parsed.error ? 'text-emerald-600' : 'text-red-600'}
					>{!result.parsed.error
						? '[PARSING SUCCESS]'
						: `[ERROR: ${result.parsed.error.split(',').at(0)}]`}</span
				>
			</div>
			<div class="w-max text-nowrap">
				{#if !result.scanned.error && !result.parsed.error}
					{@html ASTtoString(result.parsed.node)}
				{/if}
			</div>
		</div>
	</div>
</div>
