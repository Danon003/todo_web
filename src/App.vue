<template>
  <div id="app">
    <router-view/>
  </div>
</template>


<style>
#app {
  font-family: 'Arial', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-primary);
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: var(--bg-primary);
}

body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  background: var(--bg-primary);
}

/* Глобальные стили для кнопок */
button {
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  border-radius: var(--border-radius);
  padding: 8px 16px;
  font-family: inherit;
}

button:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Глобальные стили для форм */
input, textarea, select {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--input-text);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 1em;
  transition: all 0.3s;
  font-family: inherit;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(23, 162, 184, 0.1);
}

/* Глобальные стили для ссылок */
a {
  color: var(--color-primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Глобальные стили для карточек */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow-sm);
  padding: 20px;
  margin-bottom: 20px;
}

/* Утилитарные классы */
.text-primary { color: var(--text-primary) !important; }
.text-secondary { color: var(--text-secondary) !important; }
.text-muted { color: var(--text-muted) !important; }

.bg-primary { background: var(--bg-primary) !important; }
.bg-secondary { background: var(--bg-secondary) !important; }
.bg-card { background: var(--bg-card) !important; }

.border { border: 1px solid var(--border-color) !important; }
.border-top { border-top: 1px solid var(--border-color) !important; }
.border-bottom { border-bottom: 1px solid var(--border-color) !important; }
</style>