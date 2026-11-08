import './style.css'
import { App } from './core/App.ts'

const appElement = document.querySelector<HTMLDivElement>('#app')

if (!appElement) {
  throw new Error('Application root element (#app) was not found.')
}

const app = new App(appElement)
app.start()
