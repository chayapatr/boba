<script lang="ts">
	import { TEA } from '$lib';
	let source = '"hello"+3..14!=';
</script>

<div class="mx-auto flex h-[100svh] max-w-3xl flex-col gap-3 py-20">
	<div>
		<textarea bind:value={source} class="border-2 border-neutral-600 px-2 py-1" />
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
		{#each TEA(source) || [] as token}
			<li class="grid grid-cols-4 gap-3">
				<div class="font-semibold text-neutral-800">{token.type}</div>
				<div>{token.lexeme}</div>
				<div>{token.literal}</div>
				<div>{token.line}</div>
			</li>
		{/each}
	</ul>
</div>
