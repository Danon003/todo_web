// src/utils/theme.js
const THEME_KEY = 'app-theme'

export const Theme = {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
}

export function getCurrentTheme() {
    return localStorage.getItem(THEME_KEY) || Theme.LIGHT
}

export function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme)
    applyTheme(theme)

    // Можно добавить уведомление через событие
    window.dispatchEvent(new CustomEvent('theme-change', { detail: theme }))
}

export function applyTheme(theme) {
    const actualTheme = theme === Theme.AUTO ? getSystemTheme() : theme
    document.documentElement.setAttribute('data-theme', actualTheme)

    // Обновляем мета-тег для мобильных устройств
    updateThemeMeta(actualTheme)
}

function updateThemeMeta(theme) {
    let metaTheme = document.querySelector('meta[name="theme-color"]')
    if (!metaTheme) {
        metaTheme = document.createElement('meta')
        metaTheme.name = 'theme-color'
        document.head.appendChild(metaTheme)
    }

    if (theme === Theme.DARK) {
        metaTheme.content = '#1a1d23'
    } else {
        metaTheme.content = '#ffffff'
    }
}

export function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? Theme.DARK : Theme.LIGHT
}

export function initTheme() {
    const savedTheme = getCurrentTheme()
    applyTheme(savedTheme)

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (getCurrentTheme() === Theme.AUTO) {
            applyTheme(Theme.AUTO)
        }
    })
}

export function toggleTheme() {
    const current = getCurrentTheme()
    let nextTheme

    switch(current) {
        case Theme.LIGHT:
            nextTheme = Theme.DARK
            break
        case Theme.DARK:
            nextTheme = Theme.AUTO
            break
        case Theme.AUTO:
            nextTheme = Theme.LIGHT
            break
        default:
            nextTheme = Theme.LIGHT
    }

    setTheme(nextTheme)
    return nextTheme
}

export function getThemeName(theme) {
    const names = {
        [Theme.LIGHT]: 'светлая',
        [Theme.DARK]: 'тёмная',
        [Theme.AUTO]: 'автоматическая'
    }
    return names[theme] || 'светлая'
}