import './assets/theme.css'
import './assets/main.css'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initTheme } from './utils/theme'

const app = createApp(App)
initTheme()
app.use(Toast)
app.use(router)
app.mount('#app')