<script lang="ts">
	// @ts-nocheck
	import { BOBA } from '$lib';
	import type { ASTNode } from '$lib/boba/parser/generator';
	import Editor from '$lib/components/Editor.svelte';
	import { source } from '$lib/store';

	$: result = BOBA($source);

	const ASTtoString = (nodes: ASTNode[]): string => {
		if (!nodes || nodes.length === 0) return '';

		const dfs = (node: ASTNode, prefix: string): string => {
			const n = node as Record<string, unknown>;
			switch (n.type as string) {
				case 'LITERAL':
					return `<br/>${prefix}⊢ VALUE: ${n.expr}`;
				case 'BINARY':
					return `<br/>${prefix}⊢ BIN (${(n.opr as Token).lexeme})${dfs(n.left as ASTNode, prefix + '&nbsp;&nbsp;')}${dfs(n.right as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'GROUPING':
					return `<br/>${prefix}⊢ [GROUP]${dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'UNARY':
					return `<br/>${prefix}⊢ UNARY (${(n.opr as Token).lexeme})${dfs(n.right as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'VARIABLE':
					return `<br/>${prefix}⊢ VAR: ${(n.name as Token).lexeme}`;
				case 'ASSIGN':
					return `<br/>${prefix}⊢ ASSIGN (${n.name})${dfs(n.value as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'EXPRESSION':
					return `<br/>${prefix}⊢ EXPR${dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'PRINT':
					return `<br/>${prefix}⊢ PRINT${dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;')}`;
				case 'VAR':
					return `<br/>${prefix}⊢ VAR DECL: ${n.name}${n.expr ? dfs(n.expr as ASTNode, prefix + '&nbsp;&nbsp;') : ''}`;
				case 'IF':
					return (
						`<br/>${prefix}⊢ IF${dfs({ type: 'GROUPING', expr: n.condition } as ASTNode, prefix + '&nbsp;&nbsp;')}` +
						`<br/>${prefix}&nbsp;&nbsp;THEN: ${(n.then as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;&nbsp;&nbsp;')).join('')}` +
						(n.else
							? `<br/>${prefix}&nbsp;&nbsp;ELSE: ${(n.else as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;&nbsp;&nbsp;')).join('')}`
							: '')
					);
				case 'WHILE':
					return (
						`<br/>${prefix}⊢ WHILE${dfs({ type: 'GROUPING', expr: n.condition } as ASTNode, prefix + '&nbsp;&nbsp;')}` +
						`<br/>${prefix}&nbsp;&nbsp;BODY: ${(n.body as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;&nbsp;&nbsp;')).join('')}`
					);
				case 'BLOCK':
					return `<br/>${prefix}⊢ BLOCK${(n.body as ASTNode[]).map((s) => dfs(s, prefix + '&nbsp;&nbsp;')).join('')}`;
				default:
					return `<br/>${prefix}⊢ ${n.type}`;
			}
		};

		return '<span class="font-semibold">PROGRAM</span>' + nodes.map((n) => dfs(n, '')).join('');
	};
</script>

<div class="grid h-[100svh] gap-3 p-3 font-mono md:grid-cols-2 md:gap-4 md:p-4">
	<div class="h-[calc(50svh-0.75rem)] md:h-[calc(100svh-2rem)]">
		<Editor {result} />
	</div>

	<div
		class="flex h-[calc(50svh-1.5rem)] flex-col gap-3 text-xs md:h-[calc(100vh-2rem)] md:gap-4 md:text-sm"
	>
		<!-- TOKENS -->
		<ul class="flex flex-col overflow-y-scroll rounded-md border bg-gray-50 p-4" style="height: 30%">
			<div class="mb-1 font-semibold">
				<span class={result.scanned.success ? 'text-emerald-600' : 'text-red-600'}>
					{result.scanned.success ? '[SCANNING SUCCESS]' : `[ERROR: ${result.scanned.msg}]`}
				</span>
			</div>
			<li class="mb-1 grid grid-cols-4 gap-3 font-semibold">
				<div class="text-neutral-800">TYPE</div>
				<div>LEXEME</div>
				<div>LITERAL</div>
				<div>LINE</div>
			</li>
			<div class="mb-1 w-full border-t border-neutral-400"></div>
			{#each result.scanned.tokens.filter((t) => !['NEWLINE', 'SPACE'].includes(t.type)) as token}
				<li class="grid grid-cols-4 gap-3">
					<div class="text-neutral-800">{token.type}</div>
					<div class="w-full overflow-x-clip">{token.lexeme}</div>
					<div class={`${token.literal ?? 'text-neutral-400'}`}>{token.literal}</div>
					<div>{token.line}</div>
				</li>
			{/each}
		</ul>

		<!-- AST -->
		<div class="flex flex-col overflow-scroll rounded-md border bg-gray-50 p-4" style="height: 35%">
			<div class="mb-1 font-semibold">
				<span class={!result.parsed.error ? 'text-emerald-600' : 'text-red-600'}>
					{!result.parsed.error
						? '[PARSING SUCCESS]'
						: `[ERROR: ${result.parsed.error.split(',').at(0)}]`}
				</span>
			</div>
			<div class="w-max text-nowrap">
				{#if result.scanned.success && !result.parsed.error}
					{@html ASTtoString(result.parsed.nodes)}
				{/if}
			</div>
		</div>

		<!-- OUTPUT -->
		<div class="flex flex-col overflow-scroll rounded-md border bg-gray-50 p-4" style="height: 35%">
			<div class="mb-1 font-semibold">
				<span
					class={result.interpreted.error
						? 'text-red-600'
						: 'text-emerald-600'}
				>
					{result.interpreted.error
						? `[RUNTIME ERROR: ${result.interpreted.error}]`
						: '[OUTPUT]'}
				</span>
			</div>
			{#if result.interpreted.output.length === 0 && !result.interpreted.error}
				<div class="text-neutral-400">[no output]</div>
			{:else}
				{#each result.interpreted.output as line}
					<div>{line}</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
