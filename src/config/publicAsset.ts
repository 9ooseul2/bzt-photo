/**
 * public 폴더에 있는 파일(작품 사진, 3D 모델 등)의 실제 주소를 만든다.
 *
 * 작품 목록에는 '/images/artworks/a.jpg'처럼 적어도 되고, 불러오는 쪽에서 이 함수를 거치면
 * 사이트가 github.io/bzt-photo/ 같은 하위 주소에 있든 정식 도메인에 있든 올바른 주소가 된다.
 * 'https://...' 같은 외부 주소는 그대로 둔다.
 */
export function publicAsset(path: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return path
  return import.meta.env.BASE_URL + path.replace(/^\.?\/+/, '')
}
