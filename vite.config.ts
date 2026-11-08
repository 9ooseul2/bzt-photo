import { defineConfig } from 'vite'

export default defineConfig({
  // 상대 경로로 빌드: github.io/bzt-photo/ 같은 하위 주소와 정식 도메인(루트) 어디에 올려도
  // 같은 결과물이 동작한다. 도메인을 바꿔도 이 값은 고칠 필요가 없다.
  base: './',
})
