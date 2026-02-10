import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0',
		allowedHosts: ['qforge.maruqes.com'],
		hmr: {
			protocol: 'wss',
			host: 'qforge.maruqes.com',
			clientPort: 443
		}
	},
	preview: {
		host: '0.0.0.0'
	}
});
