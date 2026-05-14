import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { requestPersistentStorage } from './db'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Best-effort: ask the browser to keep our IndexedDB data around even when
// storage is tight. Critical on iOS, where transient storage gets evicted
// aggressively after a few days of inactivity.
void requestPersistentStorage()
