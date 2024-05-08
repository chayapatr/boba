<script lang="ts">
	import { TEA, beautify } from '$lib';
	let source = '"hello"+3..14!=';
	$: tokens = TEA(source) || [];
	$: rows = source.split('\n').length;
</script>

<div class="mx-auto flex h-[100svh] max-w-3xl flex-col gap-3 py-20">
	<div class="mb-2 flex gap-3 border-y py-4 font-mono">
		<div class="w-10">
			{#each Array(rows) as _, i}
				<div class="text-neutral-600">{i + 1}</div>
			{/each}
		</div>
		<div class="relative w-full">
			<div class="w-full">{@html beautify(tokens)}</div>
			<textarea
				{rows}
				name=""
				id=""
				class="absolute left-0 top-0 w-full bg-transparent font-mono outline-none"
				style={`color: ${tokens.length <= 0 ? 'black' : 'transparent'}; caret-color: black;`}
				bind:value={source}
			></textarea>
		</div>
	</div>

	<ul class="flex flex-col">
		<!-- {JSON.stringify(TEA(source))} -->
		<li class="mb-1 grid grid-cols-4 gap-3">
			<div class="font-semibold text-neutral-800">TYPE</div>
			<div>LEXEME</div>
			<div>LITERAL</div>
			<div>LINE</div>
		</li>
		<div class="mb-1 w-full border-t border-neutral-400"></div>
		{#each tokens as token}
			<li class="grid grid-cols-4 gap-3">
				<div class="font-semibold text-neutral-800">{token.type}</div>
				<div>{token.lexeme}</div>
				<div>{token.literal}</div>
				<div>{token.line}</div>
			</li>
		{/each}
	</ul>
</div>
