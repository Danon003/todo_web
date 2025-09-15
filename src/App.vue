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
  color: #2c3e50;
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: #f5f5f7;
}

body, html {
  margin: 0;
  padding: 0;
  width: 100%;
}
/* Глобальные стили для кнопок */
button {
  cursor: pointer;
  transition: all 0.3s ease;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Глобальные стили для форм */
input, textarea, select {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 1em;
  transition: border-color 0.3s;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: #4a90e2;
}

/* Глобальные стили для ссылок */
a {
  color: #4a90e2;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Глобальные стили для карточек */
.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 20px;
  margin-bottom: 20px;
}

</style>