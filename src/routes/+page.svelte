<script lang="ts">
	import { TEA } from '$lib';
	import Editor from '$lib/components/Editor.svelte';
	import { source } from '$lib/store';
</script>

<div class="mx-auto my-20 flex max-w-3xl flex-col gap-6">
	<div class="h-96">
		<Editor {source} />
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
		{#each TEA($source) || [] as token}
			<li class="grid grid-cols-4 gap-3">
				<div class="font-semibold text-neutral-800">{token.type}</div>
				<div>{token.lexeme}</div>
				<div class={`${token.literal ?? 'text-neutral-300'}`}>{token.literal}</div>
				<div>{token.line}</div>
			</li>
		{/each}
	</ul>
</div>
