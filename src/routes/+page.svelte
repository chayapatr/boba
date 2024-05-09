<script lang="ts">
	import { BOBA } from '$lib';
	import Editor from '$lib/components/Editor.svelte';
	import { source } from '$lib/store';

	$: result = BOBA($source);
</script>

<div class="grid h-[100svh] gap-3 p-3 md:grid-cols-2 md:gap-4 md:p-4">
	<div class="h-[calc(50svh-0.75rem)] md:h-[calc(100svh-2rem)]">
		<Editor {result} />
	</div>

	<div
		class="flex h-[calc(50svh-1.5rem)] flex-col gap-3 text-xs md:h-[calc(100vh-2rem)] md:gap-4 md:text-sm"
	>
		<ul class="flex h-1/2 flex-col overflow-y-scroll rounded-md border bg-gray-50 p-4">
			<div class="mb-1 font-semibold">
				<span class={result.success ? 'text-emerald-600' : 'text-red-600'}
					>{result.success ? 'SCANNING SUCCESS' : `ERROR: ${result.msg}`}</span
				>
			</div>
			<li class="mb-1 grid grid-cols-4 gap-3 font-semibold">
				<div class=" text-neutral-800">TYPE</div>
				<div>LEXEME</div>
				<div>LITERAL</div>
				<div>LINE</div>
			</li>
			<div class="mb-1 w-full border-t border-neutral-400"></div>
			{#each result.tokens.filter((token) => !['NEWLINE', 'SPACE'].includes(token.type)) || [] as token}
				<li class="grid grid-cols-4 gap-3">
					<div class=" text-neutral-800">{token.type}</div>
					<div class="w-full overflow-x-clip">{token.lexeme}</div>
					<div class={`${token.literal ?? 'text-neutral-400'}`}>{token.literal}</div>
					<div>{token.line}</div>
				</li>
			{/each}
		</ul>
		<div class="flex h-1/2 items-center justify-center rounded-md border bg-gray-50">
			PLACEHOLDER FOR AST
		</div>
	</div>
</div>
