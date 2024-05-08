/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		fontFamily: {
			mono: ['"Zed Mono Extended"']
		},
		extend: {},
	},

	plugins: [require('@tailwindcss/typography')]
};
